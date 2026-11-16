import { useState, useEffect, useRef } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

export type StrategyPreset = 'OVER_2_UNDER_7_RED_CURSOR' | 'OVER_3_UNDER_6_CONSECUTIVE';

export interface StrategySignal {
  isReady: boolean;
  recommendedSide: 'OVER' | 'UNDER' | null;
  headline: string;
  subtext: string;
}

const ALL_MANUAL_SYMBOLS = [
  'R_10',
  '1HZ10V',
  'R_25',
  '1HZ25V',
  'R_50',
  '1HZ50V',
  'R_75',
  '1HZ75V',
  'R_100',
  '1HZ100V',
];

// Global module-level cache so switching tabs or markets keeps all 1,000-tick buffers warm
const globalTickBuffers: Record<string, number[]> = {};
const globalPipSizes: Record<string, number> = {};
const subscribedNonR10 = new Set<string>();
const lastTickTime: Record<string, number> = {};
let isPoolBootstrapped = false;

const extractLastDigit = (quote: number, pipSize: number): number => {
  const formatted = Number(quote).toFixed(pipSize);
  return parseInt(formatted.charAt(formatted.length - 1), 10);
};

// Single global listener for Manual Trader (runs alongside useScannerFeed without conflict)
const handleManualSocketMessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data);
    if (data?.msg_type === 'tick' && data?.tick?.symbol) {
      const sym = data.tick.symbol;
      if (!ALL_MANUAL_SYMBOLS.includes(sym)) return;

      if (data.tick.pip_size !== undefined) {
        globalPipSizes[sym] = data.tick.pip_size;
      }
      const pip = globalPipSizes[sym] ?? 2;
      const digit = extractLastDigit(data.tick.quote, pip);

      if (!globalTickBuffers[sym]) globalTickBuffers[sym] = [];
      globalTickBuffers[sym] = [...globalTickBuffers[sym].slice(-999), digit];
      lastTickTime[sym] = Date.now();
    }
  } catch {
    // Ignore non-JSON messages
  }
};

export function useManualMultiStream(
  activeSymbol: string,
  targetDigit: number,
  duration: number,
  stake: number,
  preset: StrategyPreset
) {
  const [tickVersion, setTickVersion] = useState(0);
  const [payouts, setPayouts] = useState<{ over: string; under: string }>({
    over: 'Calculating...',
    under: 'Calculating...',
  });

  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;

  // 1. Bootstrap 1,000-tick buffers and non-R_10 streams without touching useScannerFeed's R_10 subscription
  useEffect(() => {
    let isMounted = true;

    const initPool = async () => {
      while (!api_base?.api) {
        await new Promise(r => setTimeout(r, 250));
        if (!isMounted) return;
      }

      const socket = api_base.api.connection;
      if (socket) {
        socket.removeEventListener('message', handleManualSocketMessage);
        socket.addEventListener('message', handleManualSocketMessage);
      }

      if (!isPoolBootstrapped) {
        isPoolBootstrapped = true;

        for (const sym of ALL_MANUAL_SYMBOLS) {
          if (!isMounted) return;
          try {
            if (!globalTickBuffers[sym] || globalTickBuffers[sym].length < 100) {
              const hist = await api_base.api.send({
                ticks_history: sym,
                adjust_start_time: 1,
                count: 1000,
                end: 'latest',
                style: 'ticks',
              });
              if (hist?.pip_size !== undefined) globalPipSizes[sym] = hist.pip_size;
              if (hist?.history?.prices) {
                const pip = globalPipSizes[sym] ?? 2;
                globalTickBuffers[sym] = hist.history.prices.map((p: number) =>
                  extractLastDigit(p, pip)
                );
              }
            }

            // NEVER subscribe to R_10 here (useScannerFeed already owns R_10)
            if (sym !== 'R_10' && !subscribedNonR10.has(sym)) {
              await api_base.api.send({ ticks: sym, subscribe: 1 });
              subscribedNonR10.add(sym);
            }
          } catch (err: any) {
            if (err?.error?.code === 'AlreadySubscribed') {
              subscribedNonR10.add(sym);
            }
          }
          await new Promise(r => setTimeout(r, 250));
        }
      }
    };

    initPool();

    // UI refresh loop + auto-heal if SmartCharts resets non-R_10 streams
    const uiInterval = setInterval(async () => {
      setTickVersion(v => v + 1);

      const now = Date.now();
      for (const sym of ALL_MANUAL_SYMBOLS) {
        if (sym === 'R_10') continue;
        if (subscribedNonR10.has(sym) && lastTickTime[sym] && now - lastTickTime[sym] > 8000) {
          subscribedNonR10.delete(sym);
          try {
            await api_base.api?.send({ ticks: sym, subscribe: 1 });
            subscribedNonR10.add(sym);
            lastTickTime[sym] = Date.now();
          } catch {
            // Retry on next check
          }
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearInterval(uiInterval);
    };
  }, []);

  // 2. Fetch real-time Deriv proposal payouts whenever parameters change
  useEffect(() => {
    let active = true;
    const validStake = Math.max(0.35, Number(stake) || 1);

    const fetchProposals = async () => {
      if (!api_base?.api) return;
      try {
        const [overRes, underRes] = await Promise.all([
          targetDigit < 9
            ? api_base.api.send({
                proposal: 1,
                amount: validStake,
                basis: 'stake',
                contract_type: 'DIGITOVER',
                currency: 'USD',
                duration,
                duration_unit: 't',
                symbol: activeSymbol,
                barrier: String(targetDigit),
              })
            : Promise.resolve(null),
          targetDigit > 0
            ? api_base.api.send({
                proposal: 1,
                amount: validStake,
                basis: 'stake',
                contract_type: 'DIGITUNDER',
                currency: 'USD',
                duration,
                duration_unit: 't',
                symbol: activeSymbol,
                barrier: String(targetDigit),
              })
            : Promise.resolve(null),
        ]);

        if (!active) return;

        const overProfit = overRes?.proposal
          ? `+${(overRes.proposal.payout - validStake).toFixed(2)} USD`
          : 'N/A';
        const underProfit = underRes?.proposal
          ? `+${(underRes.proposal.payout - validStake).toFixed(2)} USD`
          : 'N/A';

        setPayouts({ over: overProfit, under: underProfit });
      } catch {
        if (active) setPayouts({ over: 'Unavailable', under: 'Unavailable' });
      }
    };

    const debounce = setTimeout(fetchProposals, 250);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [activeSymbol, targetDigit, duration, stake]);

  // 3. Compute 1,000-tick digit distribution for active market
  const buffer = globalTickBuffers[activeSymbol] || [];
  const counts = new Array(10).fill(0);
  buffer.forEach(d => {
    if (d >= 0 && d <= 9) counts[d]++;
  });
  const total = buffer.length || 1;
  const percentages = counts.map(c => Number(((c / total) * 100).toFixed(1)));
  const cursorDigit = buffer.length > 0 ? buffer[buffer.length - 1] : 0;
  const recentDigits = buffer.slice(-5);

  let maxPct = -1;
  let minPct = 999;
  let highIdx = 0;
  let lowIdx = 0;
  percentages.forEach((pct, idx) => {
    if (pct > maxPct) {
      maxPct = pct;
      highIdx = idx;
    }
    if (pct < minPct) {
      minPct = pct;
      lowIdx = idx;
    }
  });

  const digitStats = percentages.map((percent, digit) => {
    let trend: 'neutral' | 'high' | 'low' | 'selected' = 'neutral';
    if (digit === highIdx) trend = 'high';
    if (digit === lowIdx) trend = 'low';
    if (digit === targetDigit) trend = 'selected';
    return { digit, percent, trend };
  });

  // 4. Evaluate real strategy entry rules
  const evaluateSignal = (): StrategySignal => {
    const pct = (d: number) => percentages[d] ?? 10;
    const isCursorOnRedRing = cursorDigit === lowIdx;

    if (preset === 'OVER_2_UNDER_7_RED_CURSOR') {
      if (targetDigit === 7) {
        const highZoneValid = pct(7) > 10 && pct(8) > 10 && pct(9) > 10;
        if (!highZoneValid) {
          return {
            isReady: false,
            recommendedSide: null,
            headline: `Filter Blocked: Digits 7 (${pct(7)}%), 8 (${pct(8)}%), 9 (${pct(9)}%) must all be >10%`,
            subtext: 'Wait or switch Volatility index',
          };
        }
        if (isCursorOnRedRing) {
          return {
            isReady: true,
            recommendedSide: 'UNDER',
            headline: `EXECUTE UNDER 7 NOW! Cursor hit Red Digit ${lowIdx} (${percentages[lowIdx]}%)`,
            subtext: '7, 8, 9 > 10% + Red Ring Triggered',
          };
        }
        return {
          isReady: false,
          recommendedSide: 'UNDER',
          headline: `Armed for UNDER 7 (7,8,9 > 10%). Waiting for cursor on Red Digit ${lowIdx}...`,
          subtext: 'Watch cursor',
        };
      }

      if (targetDigit === 2) {
        const lowZoneValid = pct(0) > 10 && pct(1) > 10 && pct(2) > 10;
        if (!lowZoneValid) {
          return {
            isReady: false,
            recommendedSide: null,
            headline: `Filter Blocked: Digits 0 (${pct(0)}%), 1 (${pct(1)}%), 2 (${pct(2)}%) must all be >10%`,
            subtext: 'Wait or switch Volatility index',
          };
        }
        if (isCursorOnRedRing) {
          return {
            isReady: true,
            recommendedSide: 'OVER',
            headline: `EXECUTE OVER 2 NOW! Cursor hit Red Digit ${lowIdx} (${percentages[lowIdx]}%)`,
            subtext: '0, 1, 2 > 10% + Red Ring Triggered',
          };
        }
        return {
          isReady: false,
          recommendedSide: 'OVER',
          headline: `Armed for OVER 2 (0,1,2 > 10%). Waiting for cursor on Red Digit ${lowIdx}...`,
          subtext: 'Watch cursor',
        };
      }
    }

    if (preset === 'OVER_3_UNDER_6_CONSECUTIVE') {
      const [prev, curr] = recentDigits.slice(-2);

      if (targetDigit === 3 && prev !== undefined && curr !== undefined) {
        const twoLowInRow = [0, 1, 2].includes(prev) && [0, 1, 2].includes(curr);
        const lowDigitsCold = pct(0) < 10 && pct(1) < 10;

        if (twoLowInRow && lowDigitsCold) {
          return {
            isReady: true,
            recommendedSide: 'OVER',
            headline: `EXECUTE OVER 3 NOW! 2 consecutive low digits (${prev} -> ${curr}) detected`,
            subtext: 'Snap-back setup active',
          };
        }
        return {
          isReady: false,
          recommendedSide: 'OVER',
          headline: `Scanning Over 3: Waiting for 2 consecutive digits in [0, 1, 2] (Last: ${prev ?? '-'} -> ${curr ?? '-'})`,
          subtext: `0: ${pct(0)}% | 1: ${pct(1)}%`,
        };
      }

      if (targetDigit === 6 && prev !== undefined && curr !== undefined) {
        const twoHighInRow = [7, 8, 9].includes(prev) && [7, 8, 9].includes(curr);
        const highDigitsCold = pct(8) < 10 && pct(9) < 10;

        if (twoHighInRow && highDigitsCold) {
          return {
            isReady: true,
            recommendedSide: 'UNDER',
            headline: `EXECUTE UNDER 6 NOW! 2 consecutive high digits (${prev} -> ${curr}) detected`,
            subtext: 'Snap-back setup active',
          };
        }
        return {
          isReady: false,
          recommendedSide: 'UNDER',
          headline: `Scanning Under 6: Waiting for 2 consecutive digits in [7, 8, 9] (Last: ${prev ?? '-'} -> ${curr ?? '-'})`,
          subtext: `8: ${pct(8)}% | 9: ${pct(9)}%`,
        };
      }
    }

    return {
      isReady: false,
      recommendedSide: null,
      headline: `Live 1,000-tick stream active on ${activeSymbol} (Last digits: ${recentDigits.join(' -> ')})`,
      subtext: 'Select Digit 2, 3, 6, or 7 for preset triggers',
    };
  };

  return {
    digitStats,
    cursorDigit,
    recentDigits,
    payouts,
    signal: evaluateSignal(),
    allBuffers: globalTickBuffers,
    tickVersion,
  };
}
