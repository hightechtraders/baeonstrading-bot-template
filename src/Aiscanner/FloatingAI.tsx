// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
import { ScannerLogic } from './scannerLogic';
import { ScannerBridge } from './scannerBridge';
import { Strategy } from './strategies';
import './FloatingAI.css';
 
const scanner = new ScannerLogic();

export const FloatingAI: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  
  // 🎯 Visual signal banner notifications state
  const [signalBannerText, setSignalBannerText] = useState<string>("🔍 Listening to Live Deriv Ticks (Zero Fallback)...");
  const [isSignalLocked, setIsSignalLocked] = useState<boolean>(false);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const expandedIndexRef = useRef<number | null>(null);

  // Keep ref synchronized so card expansions/editing actions don't get overwritten
  useEffect(() => {
    expandedIndexRef.current = expandedIndex;
  }, [expandedIndex]);

  const [stake, setStake] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(20);
  const [takeProfit, setTakeProfit] = useState<number>(50);

  // 1. Listen for high-confidence 99% sniper signal lock events from scannerLogic
  useEffect(() => {
    const handleSignalLock = (e: CustomEvent) => {
      setSignalBannerText(e.detail?.message || "🎯 99% CONFIDENCE LOCKED (3x Ticks): Ready to Load Strategy");
      setIsSignalLocked(true);
    };

    window.addEventListener('ai-signal-locked', handleSignalLock as EventListener);
    return () => {
      window.removeEventListener('ai-signal-locked', handleSignalLock as EventListener);
    };
  }, []);

  // 2. Listen exclusively to real-time live strategy updates pushed by incoming WebSocket ticks
  useEffect(() => {
    if (isOpen) {
      setIsScanning(true);
      setExpandedIndex(null);
      setIsSignalLocked(false);
      setSignalBannerText("🔍 Connecting to Live Deriv Markets...");

      const handleLiveStrategiesUpdate = (e: CustomEvent) => {
        if (e.detail?.strategies) {
          // Pause updates if user has an expanded card drawer open for editing
          if (expandedIndexRef.current === null) {
            setStrategies(e.detail.strategies);
            setIsScanning(false); // Seamlessly dismiss scanning loader on first live tick packet
          }
        }
      };

      window.addEventListener('ai-strategies-updated' as any, handleLiveStrategiesUpdate as EventListener);

      return () => {
        window.removeEventListener('ai-strategies-updated' as any, handleLiveStrategiesUpdate as EventListener);
      };
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
    <div className="floating-ai-container">
      <button className="dancing-orb" onClick={() => setIsOpen(true)}>
        🤖 AI
      </button>

      {isOpen && (
        <div className="ai-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h2>AI Multi-Asset Scanner</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            {/* 🎯 VISUAL SIGNAL BANNER */}
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

            <p className="scanner-instruction">Balanced strategies rank below. Tap card to edit.</p>

            {/* SCANNING STATE HEADER OR TOP GLOBAL WINNER */}
            {isScanning ? (
              <div className="global-winner-section">
                <div className="global-winner-meta">
                  <span>GLOBAL WINNER</span>
                  <span>WAITING FOR LIVE TICKS...</span>
                </div>
                <div className="strategy-card top-card">
                  <div className="card-main-row">
                    <span className="badge-rank">#1</span>
                    <div className="strategy-info">
                      <strong>Streaming Deriv Volatility...</strong>
                      <div className="card-tags-row">
                        <span className="market-tag">SYNTHETIC</span>
                        <span className="direction-tag flat">LIVE</span>
                      </div>
                    </div>
                    <span className="badge-high">0%</span>
                  </div>
                </div>
              </div>
            ) : (
              topWinner && (
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
              )
            )}

            {/* REMAINING STRATEGIES LIST */}
            {!isScanning && (
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
            )}

          </div>
        </div>
      )}
    </div>
  );
};
