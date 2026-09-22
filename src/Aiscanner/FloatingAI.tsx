import React, { useState } from 'react';
import Draggable from 'react-draggable';
import './FloatingAI.css';
import { CORE_7_STRATEGIES as strategies } from './strategies';

export const FloatingAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);

  const toggleModal = () => {
    setIsOpen((prev) => {
      const nextState = !prev;
      if (nextState && strategies.length > 0) {
        const topId = strategies[0].id ?? 0;
        setExpandedId(topId);
      }
      return nextState;
    });
  };

  return (
    <Draggable cancel="button, input, select, .card-expandable">
      <div className="floating-ai-container">
        <button 
          className="ai-trigger-btn" 
          onClick={toggleModal} 
          title="Toggle AI Multi-Asset Scanner"
        >
          <span className="ai-btn-label">AI</span>
          <span className="pulse-ring"></span>
          <span className="pulse-ring delay"></span>
        </button>

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
              {strategies.map((strat: any, index: number) => {
                const stratId = strat.id ?? index;
                const isExpanded = expandedId === stratId;
                const rankNum = index + 1;

                const title = strat.title || strat.name || `Strategy ${rankNum}`;
                const volatility = strat.volatility || 'VOLATILITY 25';
                const contractType = strat.contractType || 'RISE FALL';
                const strategyType = strat.strategyType || 'NEURAL_FLOW';
                const risk = (strat.risk || 'HIGH').toString().toUpperCase();
                const score = strat.score ?? (85 - index * 2);
                const confidence = strat.confidence ?? (88 - index * 2);
                const description = strat.description || 'Dynamic lookback structural variant.';
                const stake = strat.stake ?? 3;
                const stopLoss = strat.stopLoss ?? 4;
                const takeProfit = strat.takeProfit ?? 8;

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
    </Draggable>
  );
};

export default FloatingAI;
