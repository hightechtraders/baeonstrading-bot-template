import React, { useState, useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { ScannerBridge } from './scannerBridge';
import { Strategy } from './strategies';
import './FloatingAI.css';

const scanner = new ScannerLogic();

export const FloatingAI: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  // Editable parameters for the chosen strategy
  const [stake, setStake] = useState<number>(10);
  const [stopLoss, setStopLoss] = useState<number>(20);
  const [takeProfit, setTakeProfit] = useState<number>(50);

  useEffect(() => {
    if (isOpen) {
      setStrategies(scanner.runScan());
      const interval = setInterval(() => {
        setStrategies(scanner.runScan());
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleSelectStrategy = (strat: Strategy) => {
    setSelectedStrategy(strat);
    setStake(strat.recommendedStake);
    setStopLoss(strat.recommendedStopLoss);
    setTakeProfit(strat.recommendedTakeProfit);
  };

  const handleRunBot = () => {
    if (!selectedStrategy) return;
    ScannerBridge.loadStrategyToWorkspace(selectedStrategy, { stake, stopLoss, takeProfit });
    alert(`Strategy "${selectedStrategy.name}" successfully loaded! Click the main platform run button to execute.`);
    setIsOpen(false);
  };

  return (
    <div className="floating-ai-container">
      {/* Dancing AI Orb Button */}
      <button className="dancing-orb" onClick={() => setIsOpen(true)}>
        🤖 AI
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="ai-modal-backdrop">
          <div className="ai-modal-content">
            <div className="ai-modal-header">
              <h2>Multi-Market AI Scanner (7 Volatilities)</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>

            {!selectedStrategy ? (
              <div className="strategy-list">
                <p className="scanner-instruction">Select a high-confidence strategy to configure:</p>
                {strategies.map((strat) => (
                  <div key={strat.id} className="strategy-card" onClick={() => handleSelectStrategy(strat)}>
                    <div>
                      <strong>{strat.name}</strong>
                      <span className="market-tag">{strat.market}</span>
                    </div>
                    <div className="confidence-badge" style={{ color: strat.confidence > 90 ? '#4ade80' : '#facc15' }}>
                      {strat.confidence}% Confidence
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="strategy-configurator">
                <h3>Configure: {selectedStrategy.name}</h3>
                <p className="market-sub">Target Market: {selectedStrategy.market}</p>

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

                <div className="config-actions">
                  <button className="back-btn" onClick={() => setSelectedStrategy(null)}>Back to Scanner</button>
                  <button className="run-manual-btn" onClick={handleRunBot}>Load & Run Strategy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
