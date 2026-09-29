import React, { useState, useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { ScannerBridge } from './scannerBridge';
import { Strategy } from './strategies';
import './FloatingAI.css';

const scanner = new ScannerLogic();

export const FloatingAI: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  
  // Track which card index is expanded (default to 0 so the top global winner starts open)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Configuration parameter states
  const [stake, setStake] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(20);
  const [takeProfit, setTakeProfit] = useState<number>(50);

  useEffect(() => {
    if (isOpen) {
      setStrategies(scanner.runScan());

      const globalWin = window as any;
      const ws = globalWin.ws || globalWin.BinarySocket || globalWin.LiveApi?.ws;

      if (ws && typeof ws.send === 'function') {
        const symbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ50', '1HZ100'];
        symbols.forEach((symbol) => {
          ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        });

        const handleMessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.msg_type === 'tick' && data.tick) {
              const { symbol, quote } = data.tick;
              const updated = scanner.processLiveTick(symbol, quote);
              setStrategies([...updated]);
            }
          } catch (err) {
            console.error('Error parsing live tick:', err);
          }
        };

        ws.addEventListener('message', handleMessage);
        return () => {
          ws.removeEventListener('message', handleMessage);
        };
      } else {
        const interval = setInterval(() => {
          setStrategies(scanner.runScan());
        }, 4000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen]);

  // Sort strategies from highest to lowest confidence score
  const sortedStrategies = [...strategies].sort((a, b) => b.confidence - a.confidence);
  const topWinner = sortedStrategies[0];
  const otherStrategies = sortedStrategies.slice(1);

  const handleRunBot = (strat: Strategy) => {
    ScannerBridge.loadStrategyToWorkspace(strat, { stake, stopLoss, takeProfit });
    alert(`Strategy "${strat.name}" successfully loaded! Click the main platform run button to execute.`);
    setIsOpen(false);
  };

  const handleCardClick = (strat: Strategy, index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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

            {/* TOP GLOBAL WINNER CARD */}
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
                      <span className="market-tag">{topWinner.market}</span>
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

            {/* REMAINING STRATEGIES LIST */}
            <div className="strategy-list">
              {otherStrategies.map((strat, idx) => {
                const actualIndex = idx + 1;
                const isExpanded = expandedIndex === actualIndex;
                const isHigh = strat.confidence >= 80;

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
                        <span className="market-tag">{strat.market}</span>
                      </div>
                      <span className={isHigh ? 'badge-high' : 'badge-medium'}>
                        {isHigh ? 'HIGH' : 'MEDIUM'}
                      </span>
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

          </div>
        </div>
      )}
    </div>
  );
};
