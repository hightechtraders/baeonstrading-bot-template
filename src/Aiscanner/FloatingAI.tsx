import React, { useState, useEffect, useRef } from 'react';
import { CORE_7_STRATEGIES, StrategyConfig } from './strategies';
import { scannerLogic } from './scannerLogic';
import { useDerivTicks, ASSET_TO_SYMBOL } from './useDerivTicks';
import './FloatingAI.css';

export const FloatingAI: React.FC = () => {
  const { ticksBuffer } = useDerivTicks();
  const [strategies, setStrategies] = useState<StrategyConfig[]>(CORE_7_STRATEGIES);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  // Initialize strategies into the logic manager on mount
  useEffect(() => {
    const initial = scannerLogic.setStrategies(CORE_7_STRATEGIES);
    setStrategies(initial);
  }, []);

  // Continuously process incoming ticks from the shared buffer
  useEffect(() => {
    if (!ticksBuffer || Object.keys(ticksBuffer).length === 0) return;

    const updated = scannerLogic.evaluateAndProcessTicks(
      ticksBuffer,
      ASSET_TO_SYMBOL,
      expandedId !== null,
      expandedId
    );
    setStrategies([...updated]);
  }, [ticksBuffer, expandedId]);

  const handleApplyToBot = (strat: StrategyConfig) => {
    scannerLogic.setHighPriority(strat.id);
    const success = scannerLogic.loadHighStrategyToWorkspace(strat);
    if (success) {
      alert(`Successfully loaded "${strat.name}" to workspace!`);
    } else {
      alert(`Could not load strategy. Ensure confidence meets break-even requirements.`);
    }
  };

  return (
    <div className={`floating-ai-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="floating-header" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="header-title">
          <span className="pulsing-orb"></span>
          <h3>AI Multi-Asset Scanner</h3>
        </div>
        <button className="toggle-btn">{isMinimized ? '+' : '-'}</button>
      </div>

      {!isMinimized && (
        <div className="strategies-list">
          {strategies.map((strat) => (
            <div
              key={strat.id}
              className={`strategy-card ${strat.priority === 'HIGH' ? 'high-priority' : ''}`}
            >
              <div className="card-top" onClick={() => setExpandedId(expandedId === strat.id ? null : strat.id)}>
                <div>
                  <span className="strat-name">{strat.name}</span>
                  <span className="strat-asset">{strat.asset}</span>
                </div>
                <div className="strat-metrics">
                  <span className={`badge ${strat.direction?.toLowerCase()}`}>
                    {strat.direction || 'HOLD'}
                  </span>
                  <span className="confidence-val">{strat.confidence ?? 50}%</span>
                </div>
              </div>

              {expandedId === strat.id && (
                <div className="card-expanded-body">
                  <p>{strat.description}</p>
                  <div className="param-grid">
                    <div>Stake: ${strat.stake}</div>
                    <div>TP: ${strat.takeProfit}</div>
                    <div>SL: ${strat.stopLoss}</div>
                  </div>
                  <button
                    className="apply-workspace-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApplyToBot(strat);
                    }}
                  >
                    Load Strategy to Bot
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
