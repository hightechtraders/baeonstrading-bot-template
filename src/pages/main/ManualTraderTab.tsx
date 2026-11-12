// ==========================================
// FILE: src/pages/main/ManualTraderTab.tsx
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
import { ScannerBridge } from '../../Aiscanner/scannerBridge';
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
    glow: 'none'
  };

  if (trendMode === 'selected' || isSelected) {
    themeConfig = {
      labelColor: '#6366f1',
      valueColor: '#ffffff',
      trackColor: 'rgba(99, 102, 241, 0.2)',
      activeColor: '#6366f1',
      background: 'rgba(99, 102, 241, 0.12)',
      glow: '0 0 16px rgba(99, 102, 241, 0.35)'
    };
  } else if (trendMode === 'high') {
    themeConfig = {
      labelColor: '#10b981',
      valueColor: '#34d399',
      trackColor: 'rgba(16, 185, 129, 0.2)',
      activeColor: '#10b981',
      background: 'rgba(16, 185, 129, 0.08)',
      glow: '0 0 12px rgba(16, 185, 129, 0.25)'
    };
  } else if (trendMode === 'low') {
    themeConfig = {
      labelColor: '#f43f5e',
      valueColor: '#fb7185',
      trackColor: 'rgba(244, 63, 94, 0.2)',
      activeColor: '#f43f5e',
      background: 'rgba(244, 63, 94, 0.08)',
      glow: '0 0 12px rgba(244, 63, 94, 0.25)'
    };
  }

  return (
    <div className="manual-digit-gauge">
      <span className="manual-digit-label" style={{ color: themeConfig.labelColor }}>{digit}</span>
      <div className="manual-gauge-circle" style={{ background: themeConfig.background, boxShadow: themeConfig.glow }}>
        <svg viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={circleRadius} fill="none" stroke={themeConfig.trackColor} strokeWidth={lineThickness} />
          <circle
            cx="44" cy="44" r={circleRadius} fill="none"
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
  const [selectedSymbol, setSelectedSymbol] = useState('Volatility 10 (1s) Index');
  const [symbolCode, setSymbolCode] = useState('1HZ10V');
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

  // Initialize targetDigit from localStorage (persists across tab switches)
  const [targetDigit, setTargetDigit] = useState<number>(() => {
    const saved = localStorage.getItem('trader_target_digit');
    return saved !== null ? parseInt(saved, 10) : 4;
  });

  const [manualStake, setManualStake] = useState<string>('500.00');
  const [cursorPosition, setCursorPosition] = useState<number>(4);
  const [scannerStatus, setScannerStatus] = useState<string>('Scanning live tick momentum...');

  const targetDigitRef = useRef(targetDigit);
  
  // Keep localStorage and ref synchronized whenever targetDigit changes
  useEffect(() => {
    targetDigitRef.current = targetDigit;
    localStorage.setItem('trader_target_digit', targetDigit.toString());
  }, [targetDigit]);

  const [digitStats, setDigitStats] = useState(() => {
    const savedDigit = localStorage.getItem('trader_target_digit');
    const initialTarget = savedDigit !== null ? parseInt(savedDigit, 10) : 4;

    return [
      { digit: 0, percent: 9.2, trend: 'neutral' },
      { digit: 1, percent: 12.6, trend: 'high' },
      { digit: 2, percent: 9.9, trend: 'neutral' },
      { digit: 3, percent: 10.1, trend: 'neutral' },
      { digit: 4, percent: 11.4, trend: initialTarget === 4 ? 'selected' : 'neutral' },
      { digit: 5, percent: 8.5, trend: 'neutral' },
      { digit: 6, percent: 10.5, trend: 'neutral' },
      { digit: 7, percent: 9.4, trend: 'neutral' },
      { digit: 8, percent: 7.7, trend: 'low' },
      { digit: 9, percent: 10.3, trend: 'neutral' }
    ].map(item => ({
      ...item,
      trend: item.digit === initialTarget ? 'selected' : item.trend
    }));
  });

  // Simulation Loop
  useEffect(() => {
    const scannerInterval = setInterval(() => {
      const weightedScannerPool = [4, 1, 8, 6, 2, 0, 9, 3, 5, 7];
      const nextActiveDigit = weightedScannerPool[Math.floor(Math.random() * weightedScannerPool.length)];
      
      setCursorPosition(nextActiveDigit);

      setDigitStats(currentStats => {
        let maxVal = -1;
        let minVal = 999;
        let highIndex = 0;
        let lowIndex = 0;

        const updatedValues = currentStats.map((item, idx) => {
          const simulatedPercent = +(Math.random() * (12.8 - 7.5) + 7.5).toFixed(1);
          if (simulatedPercent > maxVal) { maxVal = simulatedPercent; highIndex = idx; }
          if (simulatedPercent < minVal) { minVal = simulatedPercent; lowIndex = idx; }
          return { ...item, percent: simulatedPercent };
        });

        const activeTarget = targetDigitRef.current;

        return updatedValues.map((item, idx) => {
          let trend = 'neutral';
          if (idx === highIndex) trend = 'high';
          if (idx === lowIndex) trend = 'low';
          if (item.digit === activeTarget) trend = 'selected';

          return {
            ...item,
            trend
          };
        });
      });

      const statuses = [
        `Analyzing 1,000 tick sample for ${selectedSymbol}...`,
        `Momentum spike detected on digit ${nextActiveDigit}. Evaluating variance...`,
        `Probability threshold met (>89.4%). Ready for execution setup.`,
        `Scanning parity distribution across synthetic stream...`
      ];
      setScannerStatus(statuses[Math.floor(Math.random() * statuses.length)]);

    }, 2500);

    return () => clearInterval(scannerInterval);
  }, [selectedSymbol]);

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

        {/* Live Scanner Status Banner */}
        <div className="manual-status-banner">
          <div className="manual-status-content">
            <span className="manual-status-pulse" />
            <span className="manual-status-text">AI Engine: {scannerStatus}</span>
          </div>
          <span className="manual-status-badge">LIVE FEED</span>
        </div>

        {/* 10-Digit Dynamic Gauge Grid */}
        <div className="digit-stats-grid">
          <div className="digit-stats-grid__inner">
            {digitStats.map((item) => {
              const isSelected = targetDigit === item.digit;
              const isCursorHere = cursorPosition === item.digit;
              let cardModifier = '';
              if (isSelected) cardModifier = 'digit-gauge-card--selected';
              else if (item.trend === 'high') cardModifier = 'digit-gauge-card--high';
              else if (item.trend === 'low') cardModifier = 'digit-gauge-card--low';

              return (
                <div 
                  key={item.digit} 
                  onClick={() => {
                    setTargetDigit(item.digit);
                    targetDigitRef.current = item.digit;
                    setDigitStats(prev => 
                      prev.map(stat => ({
                        ...stat,
                        trend: stat.digit === item.digit ? 'selected' : (stat.trend === 'selected' ? 'neutral' : stat.trend)
                      }))
                    );
                  }}
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
            <div className="config-item">
              <span className="config-label">Blueprint</span>
              <span className="config-value">Over / Under</span>
            </div>
            <div className="config-item">
              <span className="config-label">Target Digit</span>
              <span className="config-value highlight-digit">{targetDigit}</span>
            </div>
            <div className="config-item">
              <span className="config-label">Duration</span>
              <span className="config-value">1 Tick</span>
            </div>
          </div>

          <div className="config-stake-row">
            <div className="config-stake-info">
              <span className="config-label">Risk Capital Allocation</span>
              <div className="config-input-wrapper">
                <input 
                  type='text' 
                  value={manualStake}
                  onChange={(e) => setManualStake(e.target.value)}
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

v      </div>
    </div>
  );
}
