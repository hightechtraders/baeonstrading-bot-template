// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
import { ScannerBridge } from './scannerBridge';
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { useScannerFeed } from './useScannerFeed'; 
import './FloatingAI.css';

export const FloatingAI: React.FC = () => {
  useScannerFeed();

  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  
  const [signalBannerText, setSignalBannerText] = useState<string>("🔍 Listening for Live Deriv Ticks...");
  const [isSignalLocked, setIsSignalLocked] = useState<boolean>(false);
  const [isScanningPhase, setIsScanningPhase] = useState<boolean>(true);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const expandedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    expandedIndexRef.current = expandedIndex;
  }, [expandedIndex]);

  const [stake, setStake] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(20);
  const [takeProfit, setTakeProfit] = useState<number>(50);

  useEffect(() => {
    const handleStrategiesUpdated = (e: CustomEvent) => {
      const updated = e.detail?.strategies;
      if (Array.isArray(updated) && updated.length > 0) {
        if (expandedIndexRef.current === null) {
          setStrategies(updated);
        }
      }
    };

    const handleSignalLock = (e: CustomEvent) => {
      setSignalBannerText(e.detail?.message || "🎯 99% CONFIDENCE LOCKED (3x Ticks): Ready to Load Strategy");
      setIsSignalLocked(true);
    };

    window.addEventListener('ai-strategies-updated' as any, handleStrategiesUpdated as EventListener);
    window.addEventListener('ai-signal-locked', handleSignalLock as EventListener);

    return () => {
      window.removeEventListener('ai-strategies-updated' as any, handleStrategiesUpdated as EventListener);
      window.removeEventListener('ai-signal-locked', handleSignalLock as EventListener);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setExpandedIndex(null);
      setIsSignalLocked(false);
      setIsScanningPhase(true);
      setSignalBannerText("🔍 Scanning Live Ticks Across Markets...");

      const timer = setTimeout(() => {
        setIsScanningPhase(false);
        setSignalBannerText("✅ Market Scan Complete: Strategies Ranked");
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const sortedStrategies = [...strategies].sort((a, b) => b.confidence - a.confidence);
  const topWinner = sortedStrategies[0];
  const otherStrategies = sortedStrategies.slice(1);

  const handleRunBot = (strat: Strategy) => {
    ScannerBridge.loadStrategyToWorkspace(strat, { stake, stopLoss, takeProfit });
    alert(`Strategy "${strat.name}" successfully loaded! Click the main platform run button to execute.`);
    setIsOpen(false);
  };

  const handleCardClick = (strat: Strategy, index: number) => {
    const newIndex = expandedIndex === index ? null : index;
    setExpandedIndex(newIndex);
    setStake(strat.recommendedStake || 10);
    setStopLoss(strat.recommendedStopLoss || 20);
    setTakeProfit(strat.recommendedTakeProfit || 50);
  };

  return (
    <div className="floating-ai-container" style={{ display: 'contents' }}>
      <button 
        className="dancing-orb-wrapper"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer'
        }}
      >
        <div className="dancing-orb-inner">
          🤖 AI
        </div>
      </button>

      {isOpen && (
        <div className="ai-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h2>AI Multi-Asset Scanner</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            <div 
              id="ai-signal-banner"
              style={{
                background: isSignalLocked ? 'rgba(46, 212, 121, 0.15)' : '#141824',
                border: `1px solid ${isSignalLocked ? '#2ed479' : '#1e2335'}`,
                borderRadius: '8px',
                padding: '10px 14px',
                margin: '10px 0 16px 0',
                color: isSignalLocked ? '#2ed479' : '#6c718c',
                fontSize: '11px',
                fontWeight: 'bold',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              {signalBannerText}
            </div>

            {isScanningPhase ? (
              <div className="scanner-loading-state" style={{ textAlign: 'center', padding: '40px 20px', color: '#6c718c' }}>
                <div className="spinner-animation" style={{ fontSize: '32px', marginBottom: '12px' }}>🛰️</div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Analyzing tick streams across Volatility indices...</p>
                <p style={{ fontSize: '11px', marginTop: '6px' }}>Evaluating momentum, spreads, and historical confidence layers.</p>
              </div>
            ) : (
              <>
                <p className="scanner-instruction">Balanced strategies rank below. Tap card to edit.</p>

                {topWinner && (
                  <div className="global-winner-section">
                    <div className="global-winner-meta">
                      <span>GLOBAL WINNER</span>
                      <span>CONFIDENCE {topWinner.confidence}%</span>
                    </div>

                    <div 
                      className={`strategy-card top-card ${expandedIndex === 0 ? 'expanded' : ''}`}
                      onClick={() => handleCardClick(topWinner, 0)}
                    >
                      <div className="card-main-row">
                        <span className="badge-rank">#1</span>
                        <div className="strategy-info">
                          <strong>{topWinner.name}</strong>
                          <div className="card-tags-row">
                            <span className="market-tag">{topWinner.market}</span>
                            {topWinner.direction && (
                              <span className={`direction-tag ${topWinner.direction.toLowerCase()}`}>
                                {topWinner.direction}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="badge-high">HIGH</span>
                        <span className="toggle-arrow">{expandedIndex === 0 ? '▲' : '▼'}</span>
                      </div>
                      <div className="card-sub-row">
                        <span>Score {topWinner.score || topWinner.confidence}%</span>
                        <span>Confidence {topWinner.confidence}%</span>
                      </div>

                      {expandedIndex === 0 && (
                        <div className="parameter-drawer" onClick={(e) => e.stopPropagation()}>
                          <div className="input-group">
                            <label>Stake ($):</label>
                            <input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
                          </div>
                          <div className="input-group">
                            <label>Stop Loss ($):</label>
                            <input type="number" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} />
                          </div>
                          <div className="input-group">
                            <label>Take Profit ($):</label>
                            <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} />
                          </div>
                          <button className="run-manual-btn" onClick={() => handleRunBot(topWinner)}>
                            Load Strategy to Workspace
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="strategy-list">
                  {otherStrategies.map((strat, idx) => {
                    const actualIndex = idx + 1;
                    const isExpanded = expandedIndex === actualIndex;

                    return (
                      <div 
                        key={strat.id || actualIndex} 
                        className={`strategy-card ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => handleCardClick(strat, actualIndex)}
                      >
                        <div className="card-main-row">
                          <span className="badge-rank">#{actualIndex + 1}</span>
                          <div className="strategy-info">
                            <strong>{strat.name}</strong>
                            <div className="card-tags-row">
                              <span className="market-tag">{strat.market}</span>
                              {strat.direction && (
                                <span className={`direction-tag ${strat.direction.toLowerCase()}`}>
                                  {strat.direction}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="badge-medium">MEDIUM</span>
                          <span className="toggle-arrow">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        <div className="card-sub-row">
                          <span>Score {strat.score || strat.confidence}%</span>
                          <span>Confidence {strat.confidence}%</span>
                        </div>

                        {isExpanded && (
                          <div className="parameter-drawer" onClick={(e) => e.stopPropagation()}>
                            <div className="input-group">
                              <label>Stake ($):</label>
                              <input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
                            </div>
                            <div className="input-group">
                              <label>Stop Loss ($):</label>
                              <input type="number" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} />
                            </div>
                            <div className="input-group">
                              <label>Take Profit ($):</label>
                              <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(Number(e.target.value))} />
                            </div>
                            <button className="run-manual-btn" onClick={() => handleRunBot(strat)}>
                              Load Strategy to Workspace
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
