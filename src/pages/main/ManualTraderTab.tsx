// ==========================================
// FILE: src/pages/main/ManualTraderTab.tsx
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
import { ScannerBridge } from '../../Aiscanner/scannerBridge';
import { useManualMultiStream, StrategyPreset } from '../../hooks/useManualMultiStream';
import './ManualTraderTab.scss';

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

  const [autoFireOnSignal, setAutoFireOnSignal] = useState<boolean>(false);
  const lastFiredFingerprintRef = useRef<string>('');

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

  // Connect to real multi-volatility 1,000-tick stream & strategy engine
  const { digitStats, cursorDigit, recentDigits, payouts, signal } = useManualMultiStream(
    symbolCode,
    targetDigit,
    contractDuration,
    Number(manualStake) || 1,
    strategyPreset
  );

  // Auto-Fire once per unique signal trigger when enabled
  useEffect(() => {
    if (!autoFireOnSignal || !signal.isReady || !signal.recommendedSide) return;

    const fingerprint = `${symbolCode}-${recentDigits.join('')}-${signal.recommendedSide}-${targetDigit}`;
    if (lastFiredFingerprintRef.current === fingerprint) return;
    lastFiredFingerprintRef.current = fingerprint;

    const contractType = signal.recommendedSide === 'OVER' ? 'DIGITOVER' : 'DIGITUNDER';
    ScannerBridge.executeDirectTrade(
      { strategyName: `AI ${signal.recommendedSide} ${targetDigit} (${contractDuration} Ticks)`, symbol: symbolCode },
      {
        symbol: symbolCode,
        contractType,
        barrier: String(targetDigit),
        stake: Number(manualStake) || 1,
        duration: contractDuration,
        durationUnit: 't',
      }
    );
  }, [autoFireOnSignal, signal.isReady, signal.recommendedSide, recentDigits, symbolCode, targetDigit, manualStake, contractDuration]);

  const handleTogglePreset = () => {
    if (strategyPreset === 'OVER_2_UNDER_7_RED_CURSOR') {
      setStrategyPreset('OVER_3_UNDER_6_CONSECUTIVE');
      setTargetDigit(3);
      setContractDuration(1);
    } else {
      setStrategyPreset('OVER_2_UNDER_7_RED_CURSOR');
      setTargetDigit(7);
      setContractDuration(1);
    }
  };

  const presetLabel =
    strategyPreset === 'OVER_2_UNDER_7_RED_CURSOR'
      ? 'Over 2 / Under 7 (Red Ring)'
      : 'Over 3 / Under 6 (2-Tick)';

  return (
    <div className="manual-trader-tab-container">
      <div className="manual-trader-wrapper">
        {/* Compact Market Selector Dropdown Bar */}
        <div className="manual-market-dropdown-bar">
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
                  }}
                >
                  {m.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Strategy Signal Status Banner */}
        <div
          className="manual-status-banner"
          style={
            signal.isReady
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
              style={signal.isReady ? { background: '#34d399', boxShadow: '0 0 10px #34d399' } : undefined}
            />
            <span className="manual-status-text">AI Engine: {signal.headline}</span>
          </div>
          <span className="manual-status-badge">{signal.isReady ? 'SIGNAL READY' : 'LIVE FEED'}</span>
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
            <div
              className="config-item"
              onClick={handleTogglePreset}
              style={{ cursor: 'pointer' }}
              title="Click to switch strategy preset"
            >
              <span className="config-label">Blueprint ↻</span>
              <span className="config-value">{presetLabel}</span>
            </div>

            <div className="config-item">
              <span className="config-label">Target Digit</span>
              <div className="config-stepper-control">
                <button
                  className="stepper-btn"
                  onClick={() => setTargetDigit(prev => Math.max(0, prev - 1))}
                  title="Decrease Target Digit"
                >
                  −
                </button>
                <span className="config-value highlight-digit">{targetDigit}</span>
                <button
                  className="stepper-btn"
                  onClick={() => setTargetDigit(prev => Math.min(9, prev + 1))}
                  title="Increase Target Digit"
                >
                  +
                </button>
              </div>
            </div>

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="config-label">Risk Capital Allocation</span>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: autoFireOnSignal ? '#10b981' : 'var(--text-general)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoFireOnSignal}
                    onChange={e => setAutoFireOnSignal(e.target.checked)}
                    style={{ accentColor: '#10b981', cursor: 'pointer' }}
                  />
                  Auto-Fire on Signal
                </label>
              </div>
              <div className="config-input-wrapper">
                <input
                  type="text"
                  value={manualStake}
                  onChange={e => setManualStake(e.target.value)}
                  className="manual-trader-input"
                />
                <span className="currency-tag">USD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Well-Spaced Purchase Buttons Action Zone */}
        <div className="manual-trader-buttons-grid">
          <button
            onClick={() => {
              ScannerBridge.executeDirectTrade(
                { strategyName: `Manual Over ${targetDigit} (${contractDuration} Ticks)`, symbol: symbolCode },
                {
                  symbol: symbolCode,
                  contractType: 'DIGITOVER',
                  barrier: String(targetDigit),
                  stake: Number(manualStake) || 1,
                  duration: contractDuration,
                  durationUnit: 't',
                }
              );
            }}
            style={
              signal.isReady && signal.recommendedSide === 'OVER'
                ? { outline: '2px solid #34d399', boxShadow: '0 0 22px rgba(16, 185, 129, 0.65)' }
                : undefined
            }
            className="manual-trader-btn manual-trader-btn--over"
          >
            <span className="manual-trader-btn-label">Purchase Over ({contractDuration} Ticks)</span>
            <span className="manual-trader-btn-main">OVER {targetDigit}</span>
            <span className="manual-trader-btn-payout">Payout: {payouts.over}</span>
          </button>

          <button
            onClick={() => {
              ScannerBridge.executeDirectTrade(
                { strategyName: `Manual Under ${targetDigit} (${contractDuration} Ticks)`, symbol: symbolCode },
                {
                  symbol: symbolCode,
                  contractType: 'DIGITUNDER',
                  barrier: String(targetDigit),
                  stake: Number(manualStake) || 1,
                  duration: contractDuration,
                  durationUnit: 't',
                }
              );
            }}
            style={
              signal.isReady && signal.recommendedSide === 'UNDER'
                ? { outline: '2px solid #fb7185', boxShadow: '0 0 22px rgba(244, 63, 94, 0.65)' }
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
