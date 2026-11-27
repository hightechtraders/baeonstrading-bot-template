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

const MIN_STAKE = 0.35;

// Global module-level cache so switching tabs or markets keeps all 1,000-tick buffers warm
const globalTickBuffers: Record<string, number[]> = {};
const globalPipSizes: Record<string, number> = {};
const subscribedSymbols = new Set<string>();
const lastTickTime: Record<string, number> = {};
let activeSocket: WebSocket | null = null;
let isPoolBootstrapped = false;

const extractLastDigit = (quote: number, pipSize: number): number => {
  const formatted = Number(quote).toFixed(pipSize);
  return parseInt(formatted.charAt(formatted.length - 1), 10);
};

// Deterministic instant payout estimate while live Deriv proposal is in flight
const computeInstantEstimate = (stakeVal: number, winningDigits: number, currency: string): string => {
  if (winningDigits <= 0 || winningDigits >= 10) return 'Unwinnable (0%)';
  const estProfit = stakeVal * (9.62 / winningDigits - 1);
  return `~+${estProfit.toFixed(2)} ${currency}`;
};

// Single global listener for Manual Trader across all 10 volatility indices
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
      subscribedSymbols.add(sym);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('ai-tick-received', {
            detail: { assetName: sym, quote: data.tick.quote },
          })
        );
      }
    }
  } catch {
    // Ignore non-JSON messages
  }
};

export function useManualMultiStream(
  activeSymbol: string,
  targetDigit: number,
  duration: number,
  stakeInput: string | number,
  preset: StrategyPreset
) {
  const [tickVersion, setTickVersion] = useState(0);
  const [payouts, setPayouts] = useState<{ over: string; under: string }>({
    over: 'Calculating...',
    under: 'Calculating...',
  });

  const activeSymbolRef = useRef(activeSymbol);
  activeSymbolRef.current = activeSymbol;

  // Validate stake input strictly against minimums, zero/empty, and live account balance
  const rawString = String(stakeInput).trim();
  const parsedStake = Number(rawString);
  const accountBalance = Number(api_base?.account_info?.balance ?? Infinity);
  const currency = api_base?.account_info?.currency || 'USD';
  let stakeError: string | null = null;

  if (rawString === '' || Number.isNaN(parsedStake) || parsedStake <= 0) {
    stakeError = 'Stake cannot be 0 or empty.';
  } else if (parsedStake < MIN_STAKE) {
    stakeError = `Minimum stake is ${MIN_STAKE.toFixed(2)} ${currency}.`;
  } else if (parsedStake > accountBalance) {
    stakeError = `Insufficient balance (${accountBalance.toFixed(2)} ${currency} available).`;
  } else if (parsedStake > 50000) {
    stakeError = 'Maximum stake exceeded (50,000.00 USD).';
  }

  const isStakeValid = stakeError === null;
  const isOverWinnable = targetDigit >= 0 && targetDigit < 9;
  const isUnderWinnable = targetDigit > 0 && targetDigit <= 9;

  const canBuyOver = isStakeValid && isOverWinnable;
  const canBuyUnder = isStakeValid && isUnderWinnable;

  // 1. Bootstrap 1,000-tick buffers and live subscriptions across all 10 volatility indices
  useEffect(() => {
    let isMounted = true;

    const ensureSocketListener = () => {
      const socket = api_base?.api?.connection;
      if (socket && socket !== activeSocket) {
        if (activeSocket) {
          activeSocket.removeEventListener('message', handleManualSocketMessage);
        }
        activeSocket = socket;
        activeSocket.addEventListener('message', handleManualSocketMessage);
        subscribedSymbols.clear();
      }
    };

    const initPool = async () => {
      while (!api_base?.api) {
        await new Promise(r => setTimeout(r, 250));
        if (!isMounted) return;
      }

      ensureSocketListener();

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

            if (!subscribedSymbols.has(sym)) {
              await api_base.api.send({ ticks: sym, subscribe: 1 });
              subscribedSymbols.add(sym);
              lastTickTime[sym] = Date.now();
            }
          } catch (err: any) {
            if (err?.error?.code === 'AlreadySubscribed') {
              subscribedSymbols.add(sym);
              lastTickTime[sym] = Date.now();
            }
          }
          await new Promise(r => setTimeout(r, 250));
        }
      }
    };

    initPool();

    // UI refresh loop + auto-heal if SmartCharts or socket reconnect resets any stream
    const uiInterval = setInterval(async () => {
      setTickVersion(v => v + 1);
      ensureSocketListener();

      const now = Date.now();
      for (const sym of ALL_MANUAL_SYMBOLS) {
        if (subscribedSymbols.has(sym) && lastTickTime[sym] && now - lastTickTime[sym] > 8000) {
          subscribedSymbols.delete(sym);
          try {
            await api_base.api?.send({ ticks: sym, subscribe: 1 });
            subscribedSymbols.add(sym);
            lastTickTime[sym] = Date.now();
          } catch (err: any) {
            if (err?.error?.code === 'AlreadySubscribed') {
              subscribedSymbols.add(sym);
              lastTickTime[sym] = Date.now();
            }
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

    if (!isStakeValid) {
      setPayouts({
        over: isOverWinnable ? 'Invalid Stake' : 'Unwinnable (0%)',
        under: isUnderWinnable ? 'Invalid Stake' : 'Unwinnable (0%)',
      });
      return;
    }

    // Immediately show deterministic calculation so DOM updates with 0ms latency
    setPayouts({
      over: isOverWinnable ? computeInstantEstimate(parsedStake, 9 - targetDigit, currency) : 'Unwinnable (0%)',
      under: isUnderWinnable ? computeInstantEstimate(parsedStake, targetDigit, currency) : 'Unwinnable (0%)',
    });

    const fetchProposals = async () => {
      let retries = 0;
      while (!api_base?.api && retries < 15) {
        await new Promise(r => setTimeout(r, 200));
        retries++;
      }
      if (!active || !api_base?.api) return;

      try {
        const overRes = isOverWinnable
          ? await api_base.api.send({
              proposal: 1,
              amount: parsedStake,
              basis: 'stake',
              contract_type: 'DIGITOVER',
              currency,
              duration,
              duration_unit: 't',
              underlying_symbol: activeSymbol,
              barrier: String(targetDigit),
            })
          : null;

        await new Promise(r => setTimeout(r, 60));

        const underRes = isUnderWinnable
          ? await api_base.api.send({
              proposal: 1,
              amount: parsedStake,
              basis: 'stake',
              contract_type: 'DIGITUNDER',
              currency,
              duration,
              duration_unit: 't',
              underlying_symbol: activeSymbol,
              barrier: String(targetDigit),
            })
          : null;

        if (!active) return;

        const overProfit = !isOverWinnable
          ? 'Unwinnable (0%)'
          : overRes?.proposal
          ? `+${(Number(overRes.proposal.payout) - parsedStake).toFixed(2)} ${currency}`
          : computeInstantEstimate(parsedStake, 9 - targetDigit, currency);

        const underProfit = !isUnderWinnable
          ? 'Unwinnable (0%)'
          : underRes?.proposal
          ? `+${(Number(underRes.proposal.payout) - parsedStake).toFixed(2)} ${currency}`
          : computeInstantEstimate(parsedStake, targetDigit, currency);

        setPayouts({ over: overProfit, under: underProfit });
      } catch {
        // Keep instant calculation fallback if proposal call fails
      }
    };

    const debounce = setTimeout(fetchProposals, 200);
    return () => {
      active = false;
      clearTimeout(debounce);
    };
  }, [activeSymbol, targetDigit, duration, parsedStake, isStakeValid, isOverWinnable, isUnderWinnable, currency]);

  // 3. Compute 100-tick digit distribution (matching the video's 100-tick analyzer)
  const fullBuffer = globalTickBuffers[activeSymbol] || [];
  const analysisBuffer = fullBuffer.slice(-100);
  const counts = new Array(10).fill(0);
  analysisBuffer.forEach(d => {
    if (d >= 0 && d <= 9) counts[d]++;
  });
  const total = analysisBuffer.length || 1;
  const percentages = counts.map(c => Number(((c / total) * 100).toFixed(1)));
  const cursorDigit = fullBuffer.length > 0 ? fullBuffer[fullBuffer.length - 1] : 0;
  const recentDigits = fullBuffer.slice(-5);

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

  // 4. Evaluate strategy entry rules matching the video logic
  const evaluateSignal = (): StrategySignal => {
    const pct = (d: number) => percentages[d] ?? 10;
    const [prev, curr] = recentDigits.slice(-2);

    if (preset === 'OVER_2_UNDER_7_RED_CURSOR') {
      // UNDER 7: Digits 7, 8, 9 must all be <= 10%, then trigger on 2 hits in [7, 8, 9]
      if (targetDigit === 7) {
        const highZoneCold = pct(7) <= 10 && pct(8) <= 10 && pct(9) <= 10;
        if (!highZoneCold) {
          return {
            isReady: false,
            recommendedSide: null,
            headline: `Filter Blocked: Digits 7 (${pct(7)}%), 8 (${pct(8)}%), 9 (${pct(9)}%) must all be <= 10%`,
            subtext: 'Switch to a Volatility index where 7, 8, 9 are <= 10%',
          };
        }

        const twoUpperHits =
          prev !== undefined &&
          curr !== undefined &&
          [7, 8, 9].includes(prev) &&
          [7, 8, 9].includes(curr);

        if (twoUpperHits) {
          return {
            isReady: true,
            recommendedSide: 'UNDER',
            headline: `EXECUTE UNDER 7 NOW! Upper digits hit twice (${prev} -> ${curr})`,
            subtext: '7, 8, 9 <= 10% + 2-hit trigger confirmed',
          };
        }

        return {
          isReady: false,
          recommendedSide: 'UNDER',
          headline: `Armed for UNDER 7 (7,8,9 <= 10%). Waiting for 2 hits in [7, 8, 9] (Last: ${prev ?? '-'} -> ${curr ?? '-'})`,
          subtext: `7: ${pct(7)}% | 8: ${pct(8)}% | 9: ${pct(9)}%`,
        };
      }

      // OVER 2: Digits 0, 1, 2 must all be <= 10%, then trigger on 2 hits in [0, 1, 2]
      if (targetDigit === 2) {
        const lowZoneCold = pct(0) <= 10 && pct(1) <= 10 && pct(2) <= 10;
        if (!lowZoneCold) {
          return {
            isReady: false,
            recommendedSide: null,
            headline: `Filter Blocked: Digits 0 (${pct(0)}%), 1 (${pct(1)}%), 2 (${pct(2)}%) must all be <= 10%`,
            subtext: 'Switch to a Volatility index where 0, 1, 2 are <= 10%',
          };
        }

        const twoLowerHits =
          prev !== undefined &&
          curr !== undefined &&
          [0, 1, 2].includes(prev) &&
          [0, 1, 2].includes(curr);

        if (twoLowerHits) {
          return {
            isReady: true,
            recommendedSide: 'OVER',
            headline: `EXECUTE OVER 2 NOW! Lower digits hit twice (${prev} -> ${curr})`,
            subtext: '0, 1, 2 <= 10% + 2-hit trigger confirmed',
          };
        }

        return {
          isReady: false,
          recommendedSide: 'OVER',
          headline: `Armed for OVER 2 (0,1,2 <= 10%). Waiting for 2 hits in [0, 1, 2] (Last: ${prev ?? '-'} -> ${curr ?? '-'})`,
          subtext: `0: ${pct(0)}% | 1: ${pct(1)}% | 2: ${pct(2)}%`,
        };
      }
    }

    if (preset === 'OVER_3_UNDER_6_CONSECUTIVE') {
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
      headline: `Live 100-tick stream active on ${activeSymbol} (Last digits: ${recentDigits.join(' -> ')})`,
      subtext: 'Select Digit 2, 3, 6, or 7 for preset triggers',
    };
  };

  return {
    digitStats,
    cursorDigit,
    recentDigits,
    payouts,
    signal: evaluateSignal(),
    isStakeValid,
    stakeError,
    canBuyOver,
    canBuyUnder,
    allBuffers: globalTickBuffers,
    tickVersion,
  };
}
