import React, { useState, useEffect } from 'react';
import { ScannerBridge } from '../../Aiscanner/scannerBridge';
import './ManualTraderTab.scss';

function ProfessionalDigitGauge({ digit, percentage, isSelected, trendMode }) {
  const circleRadius = 18;
  const lineThickness = 3.5;
  const pathCircumference = 2 * Math.PI * circleRadius;
  
  const operationalScale = 15;
  const scaledValue = Math.min(percentage, operationalScale);
  const strokeOffsetProgress = pathCircumference - (scaledValue / operationalScale) * pathCircumference;
  
  let themeConfig = {
    labelColor: '#9ca3af',
    valueColor: 'var(--text-prominent)',
    trackColor: 'rgba(255, 255, 255, 0.08)',
    activeColor: '#6b7280',
    background: 'transparent',
    glow: 'none'
  };

  if (trendMode === 'selected' || isSelected) {
    themeConfig = {
      labelColor: '#818cf8',
      valueColor: '#ffffff',
      trackColor: '#1e1b4b',
      activeColor: '#6366f1',
      background: 'rgba(99, 102, 241, 0.15)',
      glow: '0 0 12px rgba(99, 102, 241, 0.4)'
    };
  } else if (trendMode === 'high') {
    themeConfig = {
      labelColor: '#14b8a6',
      valueColor: '#2dd4bf',
      trackColor: 'rgba(20, 184, 166, 0.15)',
      activeColor: '#14b8a6',
      background: 'rgba(20, 184, 166, 0.1)',
      glow: '0 0 10px rgba(20, 184, 166, 0.25)'
    };
  } else if (trendMode === 'low') {
    themeConfig = {
      labelColor: '#f43f5e',
      valueColor: '#fb7185',
      trackColor: 'rgba(244, 63, 94, 0.15)',
      activeColor: '#f43f5e',
      background: 'rgba(244, 63, 94, 0.1)',
      glow: '0 0 10px rgba(244, 63, 94, 0.25)'
    };
  }

  return (
    <div className="manual-digit-gauge">
      <span className="manual-digit-label" style={{ color: themeConfig.labelColor }}>{digit}</span>
      <div className="manual-gauge-circle" style={{ background: themeConfig.background, boxShadow: themeConfig.glow }}>
        <svg viewBox="0 0 44 44">
          <circle cx="22" cy="22" r={circleRadius} fill="none" stroke={themeConfig.trackColor} strokeWidth={lineThickness} />
          <circle
            cx="22" cy="22" r={circleRadius} fill="none"
            stroke={themeConfig.activeColor} strokeWidth={lineThickness}
            strokeDasharray={pathCircumference} strokeDashoffset={strokeOffsetProgress} strokeLinecap="round"
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
  const [selectedSymbol, setSelectedSymbol] = useState('Volatility 10 Index');
  const [symbolCode, setSymbolCode] = useState('R_10');
  const [isMarketDropdownOpen, setIsMarketDropdownOpen] = useState(false);

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

  const [contractType, setContractType] = useState('Over/Under');
  const [isContractDropdownOpen, setIsContractDropdownOpen] = useState(false);
  const [targetDigit, setTargetDigit] = useState<number>(8);
  const [manualStake, setManualStake] = useState<string>('500.00');
  const [cursorPosition, setCursorPosition] = useState<number>(6);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursorPosition(prev => (prev + 1) % 10);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const [digitStats] = useState([
    { digit: 0, percent: 9.5, trend: 'neutral' },
    { digit: 1, percent: 9.4, trend: 'neutral' },
    { digit: 2, percent: 10.4, trend: 'neutral' },
    { digit: 3, percent: 10.0, trend: 'neutral' },
    { digit: 4, percent: 10.4, trend: 'neutral' },
    { digit: 5, percent: 8.7,  trend: 'low' },
    { digit: 6, percent: 11.3, trend: 'high' },
    { digit: 7, percent: 11.6, trend: 'high' },
    { digit: 8, percent: 9.3,  trend: 'selected' },
    { digit: 9, percent: 9.4,  trend: 'neutral' }
  ]);

  return (
    <div className="manual-trader-tab-container">
      <div className="manual-trader-wrapper">
        
        {/* Compact Market Selector Dropdown Bar */}
        <div className="manual-market-dropdown-bar">
          <div 
            className="market-dropdown-header"
            onClick={() => setIsMarketDropdownOpen(!isMarketDropdownOpen)}
          >
            <div className="market-dropdown-title-group">
              <span className="market-type-icon">📊</span>
              <span className="market-dropdown-label">Market Mode: <strong className="banner-highlight">{selectedSymbol}</strong></span>
              <span className={`market-chevron ${isMarketDropdownOpen ? 'open' : ''}`}>›</span>
            </div>
          </div>

          {isMarketDropdownOpen && (
            <div className="market-dropdown-options">
              {markets.map((m) => (
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

        {/* 10-Digit Dynamic Gauge Grid */}
        <div className="digit-stats-grid">
          <div className="digit-stats-grid__inner">
            {digitStats.map((item) => {
              const isSelected = targetDigit === item.digit;
              const isCursorHere = cursorPosition === item.digit;
              let cardModifier = '';
              if (isSelected) cardModifier = 'digit-card--selected';
              else if (item.trend === 'high') cardModifier = 'digit-card--high';
              else if (item.trend === 'low') cardModifier = 'digit-card--low';

              return (
                <div 
                  key={item.digit} 
                  onClick={() => {
                    setTargetDigit(item.digit);
                    setCursorPosition(item.digit);
                  }}
                  className={`digit-gauge-card ${cardModifier}`}
                >
                  <ProfessionalDigitGauge
                    digit={item.digit}
                    percentage={item.percent}
                    isSelected={isSelected}
                    trendMode={isSelected ? 'selected' : item.trend}
                  />

                  {isCursorHere && (
                    <div className="digit-cursor-arrow">
                      <span>▲</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contract Type Dropdown Bar */}
        <div className="manual-contract-dropdown-bar">
          <div 
            className="contract-dropdown-header"
            onClick={() => setIsContractDropdownOpen(!isContractDropdownOpen)}
          >
            <div className="contract-dropdown-title-group">
              <span className="contract-type-icon">📈📉</span>
              <span className="contract-dropdown-label">{contractType}</span>
            </div>
            <span className={`contract-chevron ${isContractDropdownOpen ? 'open' : ''}`}>›</span>
          </div>

          {isContractDropdownOpen && (
            <div className="contract-dropdown-options">
              {['Over/Under', 'Matches/Differs', 'Even/Odd'].map((type) => (
                <div 
                  key={type}
                  className={`contract-option-item ${contractType === type ? 'active' : ''}`}
                  onClick={() => {
                    setContractType(type);
                    setIsContractDropdownOpen(false);
                  }}
                >
                  {type}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Terminal-Grade Controls Card */}
        <div className="manual-trader-controls-card">
          <div className="manual-trader-row">
            <div>
              <label className="manual-trader-label">Trade Logic Blueprint</label>
              <div className="manual-trader-target-box">
                {contractType}
              </div>
            </div>
            <div>
              <label className="manual-trader-label">Prediction Target</label>
              <div className="manual-trader-target-box">
                Digit: {targetDigit}
              </div>
            </div>
          </div>

          <div className="manual-trader-row manual-trader-row--align">
            <div>
              <label className="manual-trader-label">Contract Duration</label>
              <div className="manual-trader-duration-box">
                1 Tick Execution
              </div>
            </div>

            <div className="manual-trader-stake-container">
              <div className="manual-trader-stake-inner">
                <span className="manual-trader-stake-title">Risk Capital Allocation</span>
                <input 
                  type='text' 
                  value={manualStake}
                  onChange={(e) => setManualStake(e.target.value)}
                  className="manual-trader-input"
                />
              </div>
              <span className="manual-trader-currency-badge">USD STAKE</span>
            </div>
          </div>
        </div>

        {/* Well-Separated Purchase Buttons Action Zone */}
        <div className="manual-trader-buttons-grid">
          <button 
            onClick={() => {
              ScannerBridge.executeDirectTrade(
                { strategyName: `Manual Over ${targetDigit}`, symbol: symbolCode },
                { symbol: symbolCode, contractType: 'DIGITOVER', barrier: String(targetDigit), stake: Number(manualStake) || 1, duration: 1, durationUnit: 't' }
              );
            }}
            className="manual-trader-btn manual-trader-btn--over"
          >
            <span className="manual-trader-btn-label">Purchase Over</span>
            <span className="manual-trader-btn-main">OVER {targetDigit}</span>
            <span className="manual-trader-btn-payout">Payout: +3,514.41 USD</span>
          </button>

          <button 
            onClick={() => {
              ScannerBridge.executeDirectTrade(
                { strategyName: `Manual Under ${targetDigit}`, symbol: symbolCode },
                { symbol: symbolCode, contractType: 'DIGITUNDER', barrier: String(targetDigit), stake: Number(manualStake) || 1, duration: 1, durationUnit: 't' }
              );
            }}
            className="manual-trader-btn manual-trader-btn--under"
          >
            <span className="manual-trader-btn-label">Purchase Under</span>
            <span className="manual-trader-btn-main">UNDER {targetDigit}</span>
            <span className="manual-trader-btn-payout">Payout: +593.82 USD</span>
          </button>
        </div>

      </div>
    </div>
  );
}
