import React, { useState } from 'react';
import Draggable from 'react-draggable';
import './FloatingAI.css';

interface Strategy {
  id: number;
  rank: number;
  title: string;
  volatility: string;
  contractType: string;
  strategyType: string;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  confidence: number;
  description: string;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  direction: 'UP' | 'DOWN';
}

const STRATEGIES: Strategy[] = [
  {
    id: 1,
    rank: 1,
    title: 'AI Adaptive',
    volatility: 'Volatility 25',
    contractType: 'RISE FALL',
    strategyType: 'NEURAL_FLOW',
    risk: 'HIGH',
    score: 83,
    confidence: 84,
    description: 'Dynamic lookback structural variant.',
    stake: 3,
    stopLoss: 4,
    takeProfit: 8,
    direction: 'DOWN',
  },
  {
    id: 2,
    rank: 2,
    title: '1-3-2-6 System',
    volatility: 'Volatility 10',
    contractType: 'RISE FALL',
    strategyType: 'PROGRESSIVE',
    risk: 'MEDIUM',
    score: 81,
    confidence: 83,
    description: 'Progressive betting structure system.',
    stake: 1,
    stopLoss: 5,
    takeProfit: 10,
    direction: 'UP',
  },
];

export const FloatingAI = () => {
  const [expandedId, setExpandedId] = useState<number | null>(1);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <Draggable cancel="button, input, .card-expandable">
      <div className="scanner-modal">
        {/* Header */}
        <div className="scanner-header">
          <h3>AI Multi-Asset Scanner</h3>
          <span className="badge-counter">30/30</span>
        </div>

        {/* Global Performance Summary */}
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

        {/* Strategy List */}
        <div className="strategy-list">
          {STRATEGIES.map((strat) => {
            const isExpanded = expandedId === strat.id;
            return (
              <div 
                key={strat.id} 
                className={`strategy-card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleExpand(strat.id)}
              >
                <div className="card-top-row">
                  <span className="rank-badge">#{strat.rank}</span>
                  <div className="card-main-info">
                    <div className="card-title-row">
                      <span className="strat-title">{strat.title}</span>
                      <div className="tags-group">
                        <span className="tag volatility">{strat.volatility}</span>
                        <span className="tag contract">{strat.contractType}</span>
                        <span className="tag type">{strat.strategyType}</span>
                        <span className={`tag risk ${strat.risk.toLowerCase()}`}>
                          {strat.risk}
                        </span>
                      </div>
                    </div>
                    <div className="card-sub-metrics">
                      Score {strat.score}% · Confidence {strat.confidence}%
                    </div>
                  </div>
                </div>

                {/* Expanded Details View */}
                {isExpanded && (
                  <div className="card-expandable" onClick={(e) => e.stopPropagation()}>
                    <p className="description">{strat.description}</p>
                    <div className="parameters-grid">
                      <div>
                        <label>STAKE (USD)</label>
                        <input type="number" defaultValue={strat.stake} />
                      </div>
                      <div>
                        <label>STOP LOSS</label>
                        <input type="number" defaultValue={strat.stopLoss} />
                      </div>
                      <div>
                        <label>TAKE PROFIT</label>
                        <input type="number" defaultValue={strat.takeProfit} />
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
    </Draggable>
  );
};

export default FloatingAI;
