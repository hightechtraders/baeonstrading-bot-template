// ==========================================
// FILE: src/pages/main/ManualTraderTab.tsx
// ==========================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { useManualMultiStream, StrategyPreset } from '../../hooks/useManualMultiStream';
import './ManualTraderTab.scss';

interface TradeToast {
  id: string;
  type: 'opened' | 'won' | 'lost' | 'error';
  title: string;
  subtitle: string;
}

const BLUEPRINT_OPTIONS: { id: StrategyPreset; label: string; defaultDigit: number }[] = [
  { id: 'OVER_2_UNDER_7_RED_CURSOR', label: 'Over 2 / Under 7 (Red Ring)', defaultDigit: 7 },
  { id: 'OVER_3_UNDER_6_CONSECUTIVE', label: 'Over 3 / Under 6 (2-Tick)', defaultDigit: 3 },
];

function ProfessionalDigitGauge({ digit, percentage, isSelected, trendMode }) {
  const circleRadius = 36;
  const lineThickness = 6;
  const pathCircumference = 2 * Math.PI * circleRadius;

  const operationalScale = 15;
  const scaledValue = Math.min(percentage, operationalScale);
  const strokeOffsetProgress = pathCircumference - (scaledValue / operationalScale) * pathCircumference;

  let themeConfig = {
    labelColor: 'var(--text-general)',
    valueColor: 'var(--text-prominent)',
    trackColor: 'rgba(255, 255, 255, 0.1)',
    activeColor: '#64748b',
    background: 'transparent',
    glow: 'none',
  };

  if (trendMode === 'selected' || isSelected) {
    themeConfig = {
      labelColor: '#6366f1',
      valueColor: '#ffffff',
      trackColor: 'rgba(99, 102, 241, 0.2)',
      activeColor: '#6366f1',
      background: 'rgba(99, 102, 241, 0.12)',
      glow: '0 0 16px rgba(99, 102, 241, 0.35)',
    };
  } else if (trendMode === 'high') {
    themeConfig = {
      labelColor: '#10b981',
      valueColor: '#34d399',
      trackColor: 'rgba(16, 185, 129, 0.2)',
      activeColor: '#10b981',
      background: 'rgba(16, 185, 129, 0.08)',
      glow: '0 0 12px rgba(16, 185, 129, 0.25)',
    };
  } else if (trendMode === 'low') {
    themeConfig = {
      labelColor: '#f43f5e',
      valueColor: '#fb7185',
      trackColor: 'rgba(244, 63, 94, 0.2)',
      activeColor: '#f43f5e',
      background: 'rgba(244, 63, 94, 0.08)',
      glow: '0 0 12px rgba(244, 63, 94, 0.25)',
    };
  }

  return (
    <div className="manual-digit-gauge">
      <span className="manual-digit-label" style={{ color: themeConfig.labelColor }}>
        {digit}
      </span>
      <div className="manual-gauge-circle" style={{ background: themeConfig.background, boxShadow: themeConfig.glow }}>
        <svg viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={circleRadius} fill="none" stroke={themeConfig.trackColor} strokeWidth={lineThickness} />
          <circle
            cx="44"
            cy="44"
            r={circleRadius}
            fill="none"
            stroke={themeConfig.activeColor}
            strokeWidth={lineThickness}
            strokeDasharray={pathCircumference}
            strokeDashoffset={strokeOffsetProgress}
            strokeLinecap="round"
          />
        </svg>
        <div className="manual-gauge-value" style={{ color: themeConfig.valueColor }}>
          {percentage}%
        </div>
      </div>
    </div>
  );
}

export default function ManualTraderTab() {
  const markets = [
    { name: 'Volatility 10 Index', code: 'R_10' },
    { name: 'Volatility 10 (1s) Index', code: '1HZ10V' },
    { name: 'Volatility 25 Index', code: 'R_25' },
    { name: 'Volatility 25 (1s) Index', code: '1HZ25V' },
    { name: 'Volatility 50 Index', code: 'R_50' },
    { name: 'Volatility 50 (1s) Index', code: '1HZ50V' },
    { name: 'Volatility 75 Index', code: 'R_75' },
    { name: 'Volatility 75 (1s) Index', code: '1HZ75V' },
    { name: 'Volatility 100 Index', code: 'R_100' },
    { name: 'Volatility 100 (1s) Index', code: '1HZ100V' },
  ];

  // Initialize selectedSymbol from localStorage (defaults to Volatility 25 Index for 1-tick strategy clarity)
  const [selectedSymbol, setSelectedSymbol] = useState<string>(() => {
    return localStorage.getItem('trader_selected_symbol') || 'Volatility 25 Index';
  });

  const [symbolCode, setSymbolCode] = useState<string>(() => {
    return localStorage.getItem('trader_symbol_code') || 'R_25';
  });

  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState(false);
  const [isBlueprintDropdownOpen, setIsBlueprintDropdownOpen] = useState(false);

  const [strategyPreset, setStrategyPreset] = useState<StrategyPreset>(() => {
    return (localStorage.getItem('trader_strategy_preset') as StrategyPreset) || 'OVER_2_UNDER_7_RED_CURSOR';
  });

  const [targetDigit, setTargetDigit] = useState<number>(() => {
    const saved = localStorage.getItem('trader_target_digit');
    return saved !== null ? parseInt(saved, 10) : 7;
  });

  const [contractDuration, setContractDuration] = useState<number>(() => {
    const savedDuration = localStorage.getItem('trader_contract_duration');
    return savedDuration !== null ? parseInt(savedDuration, 10) : 1;
  });

  const [manualStake, setManualStake] = useState<string>(() => {
    return localStorage.getItem('trader_manual_stake') || '1.00';
  });

  // Auto-execution & session risk controls
  const [isAutoExecute, setIsAutoExecute] = useState<boolean>(() => {
    return localStorage.getItem('trader_auto_execute') === 'true';
  });
  const [takeProfitInput, setTakeProfitInput] = useState<string>(() => {
    return localStorage.getItem('trader_take_profit') || '10.00';
  });
  const [stopLossInput, setStopLossInput] = useState<string>(() => {
    return localStorage.getItem('trader_stop_loss') || '10.00';
  });
  const [sessionPnL, setSessionPnL] = useState<number>(0);
  const [openContractCount, setOpenContractCount] = useState<number>(0);

  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [tradeFeedback, setTradeFeedback] = useState<string | null>(null);
  const [tradeToasts, setTradeToasts] = useState<TradeToast[]>([]);

  const blueprintDropdownRef = useRef<HTMLDivElement | null>(null);
  const marketDropdownRef = useRef<HTMLDivElement | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedContractsRef = useRef<
    Record<number, { side: string; marketName: string; stake: number; currency: string }>
  >({});
  const lastAutoSignalKeyRef = useRef<string | null>(null);

  const pushTradeToast = useCallback((toast: Omit<TradeToast, 'id'>, durationMs = 5500) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setTradeToasts(prev => [...prev.slice(-2), { ...toast, id }]);
    setTimeout(() => {
      setTradeToasts(prev => prev.filter(t => t.id !== id));
    }, durationMs);
  }, []);

  const showTransientFeedback = useCallback((message: string, durationMs = 5000) => {
    setTradeFeedback(message);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => {
      setTradeFeedback(null);
    }, durationMs);
  }, []);

  // Close open dropdowns when clicking or tapping anywhere outside them
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (blueprintDropdownRef.current && !blueprintDropdownRef.current.contains(target)) {
        setIsBlueprintDropdownOpen(false);
      }
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(target)) {
        setIsMarketDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Persist settings across tab switches
  useEffect(() => {
    localStorage.setItem('trader_target_digit', targetDigit.toString());
  }, [targetDigit]);

  useEffect(() => {
    localStorage.setItem('trader_contract_duration', contractDuration.toString());
  }, [contractDuration]);

  useEffect(() => {
    localStorage.setItem('trader_selected_symbol', selectedSymbol);
    localStorage.setItem('trader_symbol_code', symbolCode);
  }, [selectedSymbol, symbolCode]);

  useEffect(() => {
    localStorage.setItem('trader_strategy_preset', strategyPreset);
  }, [strategyPreset]);

  useEffect(() => {
    localStorage.setItem('trader_manual_stake', manualStake);
  }, [manualStake]);

  useEffect(() => {
    localStorage.setItem('trader_auto_execute', String(isAutoExecute));
    if (!isAutoExecute) {
      lastAutoSignalKeyRef.current = null;
    }
  }, [isAutoExecute]);

  useEffect(() => {
    localStorage.setItem('trader_take_profit', takeProfitInput);
  }, [takeProfitInput]);

  useEffect(() => {
    localStorage.setItem('trader_stop_loss', stopLossInput);
  }, [stopLossInput]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Listen for Deriv contract settlement (proposal_open_contract) for live Win/Loss notifications & P&L limits
  useEffect(() => {
    let socket: WebSocket | null = null;

    const onContractMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.msg_type === 'proposal_open_contract' && data?.proposal_open_contract) {
          const poc = data.proposal_open_contract;
          const contractId = Number(poc.contract_id);
          const meta = trackedContractsRef.current[contractId];

          if (meta && (poc.is_sold === 1 || poc.status === 'won' || poc.status === 'lost')) {
            delete trackedContractsRef.current[contractId];
            setOpenContractCount(Object.keys(trackedContractsRef.current).length);

            const profit = Number(poc.profit ?? 0);
            const isWin = profit > 0 || poc.status === 'won';
            const formattedPnL = `${profit >= 0 ? '+' : ''}${profit.toFixed(2)} ${meta.currency}`;

            setSessionPnL(prev => {
              const updated = Number((prev + profit).toFixed(2));
              const tp = parseFloat(takeProfitInput);
              const sl = parseFloat(stopLossInput);

              if (!Number.isNaN(tp) && tp > 0 && updated >= tp) {
                setIsAutoExecute(false);
                pushTradeToast(
                  {
                    type: 'won',
                    title: 'Auto-Execution Stopped: Take Profit Hit',
                    subtitle: `Session P&L: +${updated.toFixed(2)} ${meta.currency}`,
                  },
                  7000
                );
              } else if (!Number.isNaN(sl) && sl > 0 && updated <= -Math.abs(sl)) {
                setIsAutoExecute(false);
                pushTradeToast(
                  {
                    type: 'lost',
                    title: 'Auto-Execution Stopped: Stop Loss Hit',
                    subtitle: `Session P&L: ${updated.toFixed(2)} ${meta.currency}`,
                  },
                  7000
                );
              }

              return updated;
            });

            pushTradeToast(
              {
                type: isWin ? 'won' : 'lost',
                title: `Trade closed: ${meta.side} on ${meta.marketName}`,
                subtitle: `Total profit/loss: ${formattedPnL}`,
              },
              6500
            );

            showTransientFeedback(
              `Trade Closed (${meta.side} ${meta.marketName}) | Total profit/loss: ${formattedPnL}`,
              6000
            );

            if (poc.subscription?.id) {
              api_base.api?.send({ forget: poc.subscription.id }).catch(() => {});
            }
          }
        }
      } catch {
        // Ignore non-JSON frames
      }
    };

    const attach = setInterval(() => {
      if (api_base?.api?.connection && socket !== api_base.api.connection) {
        if (socket) socket.removeEventListener('message', onContractMessage);
        socket = api_base.api.connection;
        socket.addEventListener('message', onContractMessage);
      }
    }, 300);

    return () => {
      clearInterval(attach);
      if (socket) socket.removeEventListener('message', onContractMessage);
    };
  }, [pushTradeToast, showTransientFeedback, stopLossInput, takeProfitInput]);

  // Connect to real multi-volatility 1,000-tick stream & strategy engine
  const {
    digitStats,
    cursorDigit,
    payouts,
    signal,
    isStakeValid,
    stakeError,
    canBuyOver,
    canBuyUnder,
  } = useManualMultiStream(
    symbolCode,
    targetDigit,
    contractDuration,
    manualStake,
    strategyPreset
  );

  // Verified 2-Step Proposal -> Buy Execution with live contract result subscription
  const executeManualOrder = useCallback(
    async (direction: 'DIGITOVER' | 'DIGITUNDER', isAutoTriggered = false) => {
      if (isExecuting || !isStakeValid) return;
      if (direction === 'DIGITOVER' && !canBuyOver) return;
      if (direction === 'DIGITUNDER' && !canBuyUnder) return;

      const stakeAmount = Number(Number(manualStake).toFixed(2));
      const currency = api_base?.account_info?.currency || 'USD';
      const label = direction === 'DIGITOVER' ? 'OVER' : 'UNDER';
      const sideTitle = direction === 'DIGITOVER' ? 'Over' : 'Under';
      const modeTag = isAutoTriggered ? '[AUTO] ' : '';

      // Validate against symbolCode first, then selectedSymbol name
      const matchedMarket =
        markets.find(m => m.code === symbolCode) ||
        markets.find(m => m.name === selectedSymbol);
      const activeMarketCode = matchedMarket ? matchedMarket.code : 'R_25';
      const activeMarketName = matchedMarket ? matchedMarket.name : selectedSymbol;

      if (!api_base?.api) {
        showTransientFeedback('Execution Error: Deriv WebSocket not connected.');
        if (isAutoTriggered) setIsAutoExecute(false);
        return;
      }

      setIsExecuting(true);
      setTradeFeedback(`${modeTag}Pricing ${label} ${targetDigit} on ${activeMarketCode}...`);

      try {
        // Step 1: Request proposal using strictly 'underlying_symbol' (Deriv's updated schema)
        const proposalRes = await api_base.api.send({
          proposal: 1,
          amount: stakeAmount,
          basis: 'stake',
          contract_type: direction,
          currency,
          duration: Number(contractDuration),
          duration_unit: 't',
          underlying_symbol: activeMarketCode,
          barrier: String(targetDigit),
        });

        if (proposalRes?.error) {
          const details = proposalRes.error.details ? ` (${JSON.stringify(proposalRes.error.details)})` : '';
          showTransientFeedback(`Order Rejected [${activeMarketCode}]: ${proposalRes.error.message}${details}`);
          return;
        }

        const proposalId = proposalRes?.proposal?.id;
        if (!proposalId) {
          showTransientFeedback(`Execution Error [${activeMarketCode}]: No proposal ID returned.`);
          return;
        }

        // Step 2: Buy the exact proposal ID
        setTradeFeedback(`${modeTag}Executing ${label} ${targetDigit} on ${activeMarketCode}...`);
        const buyRes = await api_base.api.send({
          buy: proposalId,
          price: stakeAmount,
        });

        if (buyRes?.error) {
          const details = buyRes.error.details ? ` (${JSON.stringify(buyRes.error.details)})` : '';
          showTransientFeedback(`Order Rejected [${activeMarketCode}]: ${buyRes.error.message}${details}`);
        } else if (buyRes?.buy) {
          const contractId = Number(buyRes.buy.contract_id);

          // Show "Trade opened" floating toast immediately
          pushTradeToast(
            {
              type: 'opened',
              title: `${modeTag}Trade opened: ${sideTitle} on ${activeMarketName}`,
              subtitle: `Stake: ${stakeAmount.toFixed(2)} ${currency}`,
            },
            4000
          );

          showTransientFeedback(
            `${modeTag}Trade opened: ${sideTitle} ${targetDigit} on ${activeMarketName} | Stake: ${stakeAmount.toFixed(2)} ${currency}`
          );

          // Track and subscribe to proposal_open_contract so settlement Win/Loss toast fires automatically
          trackedContractsRef.current[contractId] = {
            side: sideTitle,
            marketName: activeMarketName,
            stake: stakeAmount,
            currency,
          };
          setOpenContractCount(Object.keys(trackedContractsRef.current).length);

          api_base.api
            .send({
              proposal_open_contract: 1,
              contract_id: contractId,
              subscribe: 1,
            })
            .catch(() => {});
        } else {
          showTransientFeedback(`${modeTag}Order sent for ${label} ${targetDigit} on ${activeMarketCode}.`);
        }
      } catch (err: any) {
        const msg = err?.error?.message || err?.message || 'Order execution failed.';
        const details = err?.error?.details ? ` (${JSON.stringify(err.error.details)})` : '';
        showTransientFeedback(`Execution Error [${activeMarketCode}]: ${msg}${details}`);
      } finally {
        setIsExecuting(false);
      }
    },
    [
      canBuyOver,
      canBuyUnder,
      contractDuration,
      isExecuting,
      isStakeValid,
      manualStake,
      pushTradeToast,
      selectedSymbol,
      showTransientFeedback,
      symbolCode,
      targetDigit,
    ]
  );

  // Auto-execution watcher: fires once per distinct signal edge when armed and no contract is open
  useEffect(() => {
    if (!isAutoExecute) return;

    if (!signal.isReady || !signal.recommendedSide) {
      lastAutoSignalKeyRef.current = null;
      return;
    }

    if (isExecuting || openContractCount > 0 || !isStakeValid) return;

    const direction: 'DIGITOVER' | 'DIGITUNDER' | null =
      signal.recommendedSide === 'OVER' && canBuyOver
        ? 'DIGITOVER'
        : signal.recommendedSide === 'UNDER' && canBuyUnder
        ? 'DIGITUNDER'
        : null;

    if (!direction) return;

    const signalKey = `${symbolCode}|${strategyPreset}|${targetDigit}|${direction}|${signal.headline}`;
    if (lastAutoSignalKeyRef.current === signalKey) return;

    lastAutoSignalKeyRef.current = signalKey;
    executeManualOrder(direction, true);
  }, [
    canBuyOver,
    canBuyUnder,
    executeManualOrder,
    isAutoExecute,
    isExecuting,
    isStakeValid,
    openContractCount,
    signal.headline,
    signal.isReady,
    signal.recommendedSide,
    strategyPreset,
    symbolCode,
    targetDigit,
  ]);

  const handleSelectBlueprint = (option: { id: StrategyPreset; label: string; defaultDigit: number }) => {
    setStrategyPreset(option.id);
    setTargetDigit(option.defaultDigit);
    setContractDuration(1);
    setIsBlueprintDropdownOpen(false);
    lastAutoSignalKeyRef.current = null;
  };

  const activeBlueprint =
    BLUEPRINT_OPTIONS.find(b => b.id === strategyPreset) || BLUEPRINT_OPTIONS[0];

  const isOverDisabled = !canBuyOver || isExecuting;
  const isUnderDisabled = !canBuyUnder || isExecuting;
  const currency = api_base?.account_info?.currency || 'USD';

  return (
    <div className="manual-trader-tab-container">
      {/* Floating Trade Lifecycle Notifications (Trade Opened / Trade Closed P&L) */}
      {tradeToasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: 'min(92vw, 420px)',
            pointerEvents: 'none',
          }}
        >
          {tradeToasts.map(t => {
            const accent =
              t.type === 'won'
                ? '#10b981'
                : t.type === 'lost' || t.type === 'error'
                ? '#f43f5e'
                : '#38bdf8';

            return (
              <div
                key={t.id}
                style={{
                  background: 'rgba(15, 23, 42, 0.96)',
                  border: `1px solid ${accent}`,
                  borderLeft: `4px solid ${accent}`,
                  borderRadius: '10px',
                  padding: '10px 14px',
                  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
                  color: '#f8fafc',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                  <span>{t.title}</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>now</span>
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    marginTop: '3px',
                    fontWeight: 600,
                    color: t.type === 'won' ? '#34d399' : t.type === 'lost' ? '#fb7185' : '#cbd5e1',
                  }}
                >
                  {t.subtitle}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="manual-trader-wrapper">
        {/* Compact Market Selector Dropdown Bar */}
        <div className="manual-market-dropdown-bar" ref={marketDropdownRef}>
          <div className="market-dropdown-header" onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}>
            <div className="market-dropdown-title-group">
              <span className="market-type-icon">📊</span>
              <span className="market-dropdown-label">
                Market Mode: <strong className="banner-highlight">{selectedSymbol}</strong>
              </span>
              <span className={`market-chevron ${isMarketDropdownOpen ? 'open' : ''}`}>›</span>
            </div>
          </div>

          {isMarketDropdownOpen && (
            <div className="market-dropdown-options">
              {markets.map(m => (
                <div
                  key={m.code}
                  className={`market-option-item ${selectedSymbol === m.name ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedSymbol(m.name);
                    setSymbolCode(m.code);
                    setIsMarketDropdownOpen(false);
                    lastAutoSignalKeyRef.current = null;
                  }}
                >
                  {m.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Strategy Signal & Execution Feedback Banner */}
        <div
          className="manual-status-banner"
          style={
            tradeFeedback
              ? {
                  background:
                    tradeFeedback.includes('Error') ||
                    tradeFeedback.includes('Rejected') ||
                    tradeFeedback.includes(':-')
                      ? 'rgba(244, 63, 94, 0.16)'
                      : 'rgba(16, 185, 129, 0.2)',
                  borderColor:
                    tradeFeedback.includes('Error') ||
                    tradeFeedback.includes('Rejected') ||
                    tradeFeedback.includes(':-')
                      ? '#f43f5e'
                      : '#10b981',
                }
              : signal.isReady
              ? {
                  background: 'rgba(16, 185, 129, 0.18)',
                  borderColor: '#10b981',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.25)',
                }
              : undefined
          }
        >
          <div className="manual-status-content">
            <span
              className="manual-status-pulse"
              style={
                tradeFeedback?.includes('Error') ||
                tradeFeedback?.includes('Rejected') ||
                tradeFeedback?.includes(':-')
                  ? { background: '#fb7185', boxShadow: '0 0 10px #fb7185' }
                  : signal.isReady || tradeFeedback || isAutoExecute
                  ? { background: '#34d399', boxShadow: '0 0 10px #34d399' }
                  : undefined
              }
            />
            <span className="manual-status-text">AI Engine: {tradeFeedback || signal.headline}</span>
          </div>
          <span className="manual-status-badge">
            {isExecuting
              ? 'EXECUTING...'
              : isAutoExecute
              ? signal.isReady
                ? 'AUTO: FIRING'
                : 'AUTO: ARMED'
              : signal.isReady
              ? 'SIGNAL READY'
              : 'LIVE FEED'}
          </span>
        </div>

        {/* 10-Digit Dynamic Gauge Grid */}
        <div className="digit-stats-grid">
          <div className="digit-stats-grid__inner">
            {digitStats.map(item => {
              const isSelected = targetDigit === item.digit;
              const isCursorHere = cursorDigit === item.digit;
              let cardModifier = '';
              if (isSelected) cardModifier = 'digit-gauge-card--selected';
              else if (item.trend === 'high') cardModifier = 'digit-gauge-card--high';
              else if (item.trend === 'low') cardModifier = 'digit-gauge-card--low';

              return (
                <div
                  key={item.digit}
                  onClick={() => setTargetDigit(item.digit)}
                  className={`digit-gauge-card ${cardModifier}`}
                >
                  <ProfessionalDigitGauge
                    digit={item.digit}
                    percentage={item.percent}
                    isSelected={isSelected}
                    trendMode={isSelected ? 'selected' : item.trend}
                  />

                  <div className={`digit-cursor-arrow ${isCursorHere ? 'active' : ''}`}>
                    <span>▲</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Unified Professional Parameter Card */}
        <div className="manual-unified-config-card">
          <div className="config-grid-row">
            {/* Blueprint Strategy Dropdown (Left-Aligned with Compact Chevron Spacing & Outside-Click Close) */}
            <div
              ref={blueprintDropdownRef}
              className="config-item"
              style={{
                position: 'relative',
                alignItems: 'flex-start',
                textAlign: 'left',
              }}
            >
              <span className="config-label" style={{ textAlign: 'left' }}>
                Blueprint
              </span>
              <div
                onClick={() => setIsBlueprintDropdownOpen(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  width: 'fit-content',
                  maxWidth: '100%',
                  textAlign: 'left',
                }}
                title="Select trading blueprint"
              >
                <span className="config-value" style={{ textAlign: 'left' }}>
                  {activeBlueprint.label}
                </span>
                <span
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1,
                    fontWeight: 900,
                    color: '#10b981',
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isBlueprintDropdownOpen ? '▲' : '▼'}
                </span>
              </div>

              {isBlueprintDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '6px',
                    minWidth: '245px',
                    background: 'rgba(15, 23, 42, 0.98)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '10px',
                    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
                    zIndex: 50,
                    overflow: 'hidden',
                  }}
                >
                  {BLUEPRINT_OPTIONS.map(option => {
                    const isActive = option.id === strategyPreset;
                    return (
                      <div
                        key={option.id}
                        onClick={() => handleSelectBlueprint(option)}
                        style={{
                          padding: '10px 14px',
                          fontSize: '0.84rem',
                          fontWeight: isActive ? 700 : 500,
                          color: isActive ? '#34d399' : '#e2e8f0',
                          background: isActive ? 'rgba(16, 185, 129, 0.16)' : 'transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        {option.label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Target Digit (Selected via Digit Circles above) */}
            <div className="config-item">
              <span className="config-label">Target Digit</span>
              <span className="config-value highlight-digit">{targetDigit}</span>
            </div>

            {/* Duration */}
            <div className="config-item">
              <span className="config-label">Duration</span>
              <div className="config-stepper-control">
                <button
                  className="stepper-btn"
                  onClick={() => setContractDuration(prev => Math.max(1, prev - 1))}
                  title="Decrease Ticks"
                >
                  −
                </button>
                <span className="config-value">
                  {contractDuration} {contractDuration === 1 ? 'Tick' : 'Ticks'}
                </span>
                <button
                  className="stepper-btn"
                  onClick={() => setContractDuration(prev => Math.min(10, prev + 1))}
                  title="Increase Ticks"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="config-stake-row">
            <div className="config-stake-info">
              <span className="config-label">Risk Capital Allocation</span>

              <div
                className="config-input-wrapper"
                style={
                  !isStakeValid
                    ? {
                        borderColor: '#f43f5e',
                        boxShadow: '0 0 8px rgba(244, 63, 94, 0.25)',
                      }
                    : undefined
                }
              >
                <input
                  type="text"
                  value={manualStake}
                  onChange={e => setManualStake(e.target.value)}
                  className="manual-trader-input"
                  placeholder="1.00"
                />
                <span className="currency-tag">{currency}</span>
              </div>

              {stakeError && (
                <span
                  style={{
                    color: '#fb7185',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    marginTop: '4px',
                    display: 'block',
                  }}
                >
                  ⚠️ {stakeError}
                </span>
              )}
            </div>
          </div>

          {/* Auto-Execution & Session Risk Guard Strip */}
          <div
            style={{
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsAutoExecute(prev => !prev)}
                disabled={!isStakeValid && !isAutoExecute}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: isAutoExecute
                    ? '1px solid #10b981'
                    : '1px solid rgba(255, 255, 255, 0.18)',
                  background: isAutoExecute
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: isAutoExecute ? '#34d399' : '#cbd5e1',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: !isStakeValid && !isAutoExecute ? 'not-allowed' : 'pointer',
                  boxShadow: isAutoExecute ? '0 0 14px rgba(16, 185, 129, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isAutoExecute ? '#10b981' : '#64748b',
                    boxShadow: isAutoExecute ? '0 0 8px #10b981' : 'none',
                  }}
                />
                {isAutoExecute ? 'AUTO-EXECUTE: ON' : 'AUTO-EXECUTE: OFF'}
              </button>

              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: sessionPnL > 0 ? '#34d399' : sessionPnL < 0 ? '#fb7185' : '#94a3b8',
                }}
              >
                Session P&L: {sessionPnL >= 0 ? '+' : ''}
                {sessionPnL.toFixed(2)} {currency}
              </span>
              {sessionPnL !== 0 && (
                <button
                  type="button"
                  onClick={() => setSessionPnL(0)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#94a3b8',
                    borderRadius: '6px',
                    padding: '2px 7px',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                  title="Reset session P&L counter"
                >
                  Reset
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>TP ({currency}):</span>
                <input
                  type="text"
                  value={takeProfitInput}
                  onChange={e => setTakeProfitInput(e.target.value)}
                  style={{
                    width: '62px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    background: 'rgba(15, 23, 42, 0.7)',
                    color: '#34d399',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                  }}
                />
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>SL ({currency}):</span>
                <input
                  type="text"
                  value={stopLossInput}
                  onChange={e => setStopLossInput(e.target.value)}
                  style={{
                    width: '62px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(244, 63, 94, 0.35)',
                    background: 'rgba(15, 23, 42, 0.7)',
                    color: '#fb7185',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Well-Spaced Purchase Buttons Action Zone */}
        <div className="manual-trader-buttons-grid">
          <button
            disabled={isOverDisabled}
            onClick={() => executeManualOrder('DIGITOVER', false)}
            style={
              isOverDisabled
                ? {
                    opacity: 0.4,
                    filter: 'grayscale(100%)',
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                  }
                : signal.isReady && signal.recommendedSide === 'OVER'
                ? {
                    outline: '2px solid #34d399',
                    boxShadow: '0 0 22px rgba(16, 185, 129, 0.65)',
                  }
                : undefined
            }
            className="manual-trader-btn manual-trader-btn--over"
          >
            <span className="manual-trader-btn-label">Purchase Over ({contractDuration} Ticks)</span>
            <span className="manual-trader-btn-main">OVER {targetDigit}</span>
            <span className="manual-trader-btn-payout">Payout: {payouts.over}</span>
          </button>

          <button
            disabled={isUnderDisabled}
            onClick={() => executeManualOrder('DIGITUNDER', false)}
            style={
              isUnderDisabled
                ? {
                    opacity: 0.4,
                    filter: 'grayscale(100%)',
                    cursor: 'not-allowed',
                    boxShadow: 'none',
                  }
                : signal.isReady && signal.recommendedSide === 'UNDER'
                ? {
                    outline: '2px solid #fb7185',
                    boxShadow: '0 0 22px rgba(244, 63, 94, 0.65)',
                  }
                : undefined
            }
            className="manual-trader-btn manual-trader-btn--under"
          >
            <span className="manual-trader-btn-label">Purchase Under ({contractDuration} Ticks)</span>
            <span className="manual-trader-btn-main">UNDER {targetDigit}</span>
            <span className="manual-trader-btn-payout">Payout: {payouts.under}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
