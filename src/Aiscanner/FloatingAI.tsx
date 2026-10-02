import React, { useState, useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { ScannerBridge } from './scannerBridge';
import { Strategy } from './strategies';
import './FloatingAI.css';

const scanner = new ScannerLogic();

export const FloatingAI: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const [stake, setStake] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(20);
  const [takeProfit, setTakeProfit] = useState<number>(50);

  useEffect(() => {
    if (isOpen) {
      // 1. Reset and show initial SCANNING... state for 2 seconds
      setIsScanning(true);
      setExpandedIndex(null);

      const scanTimeout = setTimeout(() => {
        setStrategies(scanner.runScan());
        setIsScanning(false);
      }, 2000);

      // 2. Continuous updates (Paused automatically if a card is expanded/editing)
      const interval = setInterval(() => {
        // Only update if no card is currently expanded/being edited
        if (expandedIndex === null && !isScanning) {
          setStrategies(scanner.runScan());
        }
      }, 4000);

      return () => {
        clearTimeout(scanTimeout);
        clearInterval(interval);
      };
    }
  }, [isOpen, expandedIndex, isScanning]);

  // Keep sorting stable when a card is expanded so items don't jump around while editing
  const sortedStrategies = [...strategies].sort((a, b) => b.confidence - a.confidence);
  const topWinner = sortedStrategies[0];
  const otherStrategies = sortedStrategies.slice(1);

  const handleRunBot = (strat: Strategy) => {
    ScannerBridge.loadStrategyToWorkspace(strat, { stake, stopLoss, takeProfit });
    alert(`Strategy "${strat.name}" successfully loaded! Click the main platform run button to execute.`);
    setIsOpen(false);
  };

  const handleCardClick = (strat: Strategy, index: number) => {
    // Toggling expansion freezes updates for this card
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
            <p className="scanner-instruction">Balanced strategies rank below. Tap card to edit.</p>

            {/* SCANNING STATE HEADER OR TOP GLOBAL WINNER */}
            {isScanning ? (
              <div className="global-winner-section">
                <div className="global-winner-meta">
                  <span>GLOBAL WINNER</span>
                  <span>SCANNING...</span>
                </div>
                <div className="strategy-card top-card">
                  <div className="card-main-row">
                    <span className="badge-rank">#1</span>
                    <div className="strategy-info">
                      <strong>Analyzing Market Ticks...</strong>
                      <div className="card-tags-row">
                        <span className="market-tag">SYNTHETIC</span>
                        <span className="direction-tag flat">FLAT</span>
                      </div>
                    </div>
                    <span className="badge-high">50%</span>
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
