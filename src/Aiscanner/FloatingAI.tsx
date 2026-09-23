import React, { useState, useRef } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import './FloatingAI.css';
import { CORE_7_STRATEGIES as strategies, StrategyDefinition } from './strategies';

export const FloatingAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);

  // Track drag distance to differentiate between a tap and a drag on mobile
  const dragDistanceRef = useRef(0);

  const toggleModal = () => {
    setIsOpen((prev) => {
      const nextState = !prev;
      if (nextState) {
        setExpandedId(null);
      }
      return nextState;
    });
  };

  const handleStart = () => {
    // Reset movement distance on new touch/click start
    dragDistanceRef.current = 0;
  };

  const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
    // Accumulate movement distance during drag
    dragDistanceRef.current += Math.abs(data.deltaX) + Math.abs(data.deltaY);
  };

  const handleStop = () => {
    // If movement was negligible (less than 6px), treat as a mobile tap/click
    if (dragDistanceRef.current < 6) {
      toggleModal();
    }
  };

  return (
    <div className="floating-ai-container">
      <Draggable 
        onStart={handleStart} 
        onDrag={handleDrag} 
        onStop={handleStop}
      >
        <div className="draggable-wrapper">
          <button 
            type="button"
            className="ai-trigger-btn" 
            title="Open AI Multi-Asset Scanner"
            style={{ touchAction: 'none' }} // Prevents mobile browser page scrolling
          >
            {/* Animated Pulse Rings */}
            <span className="pulse-ring ring-1" />
            <span className="pulse-ring ring-2" />

            {/* Glowing Core Background */}
            <div className="ai-btn-glow" />

            {/* Core Label and Icon */}
            <div className="ai-btn-content">
              <span className="ai-btn-text">AI</span>
            </div>

            {/* Live Indicator Dot */}
            <span className="live-status-dot" />
          </button>
        </div>
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
