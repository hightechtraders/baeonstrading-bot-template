import React, { useState } from 'react';
import Draggable from 'react-draggable';
import './FloatingAI.css';
import { CORE_7_STRATEGIES as strategies, StrategyDefinition } from './strategies';

export const FloatingAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);

  const toggleModal = () => {
    setIsOpen((prev) => {
      const nextState = !prev;
      if (nextState) {
        setExpandedId(null); // Keep all cards collapsed on open
      }
      return nextState;
    });
  };

  return (
    <div className="floating-ai-container">
      {/* Draggable Trigger Button */}
      <Draggable>
        <button 
          className="ai-trigger-btn" 
          onClick={toggleModal} 
          title="Open AI Multi-Asset Scanner"
        >
          {/* Ambient Glow Aura */}
          <div className="ai-btn-glow" />

          {/* Professional Tech AI Icon */}
          <div className="ai-btn-content">
            <svg className="ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" opacity="0.3" />
              <path d="M12 6v12M6 12h12" strokeLinecap="round" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            <span className="ai-btn-text">AI</span>
          </div>

          {/* Live Signal Status Indicator */}
          <span className="live-status-dot" title="Live Scanner Active" />
        </button>
      </Draggable>

      {/* Scanner Modal Window */}
      {isOpen && (
        <div className="scanner-modal">
          <div className="scanner-header">
            <div className="header-title">
              <h3>AI Multi-Asset Scanner</h3>
              <span className="badge-counter">{strategies.length}/{strategies.length}</span>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div className="global-metrics-bar">
            <div className="metric-box">
              <span className="metric-label">GLOBAL WINNER</span>
              <span className="metric-value green">READY</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">DIRECTION</span>
              <span className="metric-value orange">DOWN</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">CONFIDENCE</span>
              <span className="metric-value">84%</span>
            </div>
          </div>

          <div className="strategy-list">
            {strategies.map((strat: StrategyDefinition, index: number) => {
              const stratId = strat.id ?? index;
              const isExpanded = expandedId === stratId;
              const rankNum = index + 1;

              const title = strat.name || `Strategy ${rankNum}`;
              const volatility = strat.symbol || 'VOLATILITY 25';
              const contractType = strat.type || 'RISE / FALL';
              const strategyType = strat.variant || 'NEURAL_FLOW';
              const risk = (strat.badgeLevel || 'HIGH').toString().toUpperCase();

              const evalResult = strat.evaluate ? strat.evaluate([]) : { score: 85 - index * 2, confidence: 0.88 - index * 0.02 };
              const score = evalResult.score;
              const confidence = Math.round(evalResult.confidence * 100);

              const stake = strat.parameters?.stake ?? 3;
              const stopLoss = strat.parameters?.stopLoss ?? 4;
              const takeProfit = strat.parameters?.takeProfit ?? 8;
              const description = `${strategyType} structural strategy designed for ${volatility}.`;

              return (
                <div
                  key={stratId}
                  className={`strategy-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => setExpandedId(isExpanded ? null : stratId)}
                >
                  <div className="card-top-row">
                    <span className="rank-badge">#{rankNum}</span>
                    <div className="card-main-info">
                      <div className="card-title-row">
                        <span className="strat-title">{title}</span>
                        <div className="tags-group">
                          <span className="tag volatility">{volatility}</span>
                          <span className="tag contract">{contractType}</span>
                          <span className="tag type">{strategyType}</span>
                          <span className={`tag risk ${risk.toLowerCase()}`}>
                            {risk}
                          </span>
                        </div>
                      </div>
                      <div className="card-sub-metrics">
                        Score {score}% · Confidence {confidence}%
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="card-expandable" onClick={(e) => e.stopPropagation()}>
                      <p className="description">{description}</p>
                      <div className="parameters-grid">
                        <div>
                          <label>STAKE (USD)</label>
                          <input type="number" defaultValue={stake} />
                        </div>
                        <div>
                          <label>STOP LOSS</label>
                          <input type="number" defaultValue={stopLoss} />
                        </div>
                        <div>
                          <label>TAKE PROFIT</label>
                          <input type="number" defaultValue={takeProfit} />
                        </div>
                      </div>

                      <button className="btn-primary">
                        📥 LOAD STRATEGY PARAMETERS
                      </button>
                      <button className="btn-telegram">
                        📢 Broadcast Signal to Telegram
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingAI;
