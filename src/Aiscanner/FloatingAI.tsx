import React, { useState, useRef, useEffect } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import './FloatingAI.css';
import { CORE_7_STRATEGIES, StrategyConfig, StrategySignal } from './strategies';
import { scannerLogic } from './scannerLogic';

export const FloatingAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  // Initialize strategies state with single-HIGH priority enforced
  const [strategiesList, setStrategiesList] = useState<StrategyConfig[]>(() => {
    return scannerLogic.setStrategies(CORE_7_STRATEGIES);
  });

  // Track drag distance to differentiate tap vs drag
  const dragDistanceRef = useRef(0);

  // Subscribe to live Web Worker signal updates from scannerBridge
  useEffect(() => {
    const handleSignalsUpdated = (e: CustomEvent<StrategySignal[]>) => {
      const updatedSignals = e.detail;
      if (!updatedSignals || !Array.isArray(updatedSignals) || updatedSignals.length === 0) return;

      setStrategiesList((prevList) => {
        // Merge incoming scores, directions, and confidence values into state
        const updatedList = prevList.map((strat) => {
          const match = updatedSignals.find((sig) => sig.strategyId === strat.id);
          if (match) {
            return {
              ...strat,
              score: match.score,
              confidence: match.confidence,
              direction: match.direction,
            };
          }
          return strat;
        });

        // Optional: Re-sort by highest score to rank real-time winners
        return updatedList.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      });
    };

    window.addEventListener('scanner:signals-updated' as any, handleSignalsUpdated);
    return () => {
      window.removeEventListener('scanner:signals-updated' as any, handleSignalsUpdated);
    };
  }, []);

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
    dragDistanceRef.current = 0;
  };

  const handleDrag = (_e: DraggableEvent, data: DraggableData) => {
    dragDistanceRef.current += Math.abs(data.deltaX) + Math.abs(data.deltaY);
  };

  const handleStop = () => {
    if (dragDistanceRef.current < 6) {
      toggleModal();
    }
  };

  // Safely update parameters only if strategy is HIGH priority
  const handleInputChange = (
    stratId: string,
    field: 'stake' | 'stopLoss' | 'takeProfit',
    value: number
  ) => {
    const updated = scannerLogic.updateStrategyParams(stratId, { [field]: value });
    setStrategiesList([...updated]);
  };

  // Load imported strategy parameters directly into Deriv's Blockly Workspace
  const handleLoadStrategy = (strat: StrategyConfig, e: React.MouseEvent) => {
    e.stopPropagation();

    if (strat.priority !== 'HIGH') {
      alert('Only the strategy marked as HIGH priority can be loaded into Blockly.');
      return;
    }

    const success = scannerLogic.loadHighStrategyToWorkspace(strat.id);
    if (success) {
      alert(`Strategy "${strat.name}" successfully imported into Bot Builder workspace!`);
      setIsOpen(false);
    } else {
      alert('Failed to load strategy. Make sure the Deriv Bot workspace is open.');
    }
  };

  // Dynamic Global Metrics based on top-performing strategy in state
  const highStrategy = strategiesList.find((s) => s.priority === 'HIGH') || strategiesList[0];
  const globalDirection = highStrategy?.direction || 'DOWN';
  const globalConfidence = highStrategy?.confidence ?? 84;
  const globalStatus = globalConfidence > 70 ? 'READY' : 'SCANNING';

  return (
    <div className="floating-ai-container">
      <Draggable onStart={handleStart} onDrag={handleDrag} onStop={handleStop}>
        <div className="draggable-wrapper">
          <button
            type="button"
            className="ai-trigger-btn"
            title="Open AI Multi-Asset Scanner"
            style={{ touchAction: 'none' }}
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
              <span className="badge-counter">
                {strategiesList.length}/{strategiesList.length}
              </span>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div className="global-metrics-bar">
            <div className="metric-box">
              <span className="metric-label">GLOBAL WINNER</span>
              <span className={`metric-value ${globalStatus === 'READY' ? 'green' : ''}`}>
                {globalStatus}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-label">DIRECTION</span>
              <span className={`metric-value ${globalDirection === 'UP' ? 'green' : 'orange'}`}>
                {globalDirection}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-label">CONFIDENCE</span>
              <span className="metric-value">{globalConfidence}%</span>
            </div>
          </div>

          <div className="strategy-list">
            {strategiesList.map((strat: StrategyConfig, index: number) => {
              const stratId = strat.id;
              const isExpanded = expandedId === stratId;
              const rankNum = index + 1;

              const isHighPriority = strat.priority === 'HIGH';

              const title = strat.name || `Strategy ${rankNum}`;
              const volatility = strat.asset || 'VOLATILITY 25';
              const contractType = strat.tradeType || 'RISE / FALL';
              const strategyType = strat.riskModel || 'NEURAL_FLOW';
              const priorityText = strat.priority;

              // Read live calculated metrics from state
              const score = strat.score ?? (88 - index * 3);
              const confidence = strat.confidence ?? (90 - index * 2);

              const description = `${strategyType} structural strategy designed for ${volatility}.`;

              return (
                <div
                  key={stratId}
                  className={`strategy-card ${isExpanded ? 'expanded' : ''} ${
                    isHighPriority ? 'high-active' : 'read-only'
                  }`}
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
                          <span className={`tag risk ${priorityText.toLowerCase()}`}>
                            {priorityText}
                          </span>
                        </div>
                      </div>
                      <div className="card-sub-metrics">
                        Score {score}% · Confidence {confidence}%
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      className="card-expandable"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="description">{description}</p>

                      {!isHighPriority && (
                        <div className="priority-warning">
                          🔒 Only HIGH priority strategies are editable and loadable.
                        </div>
                      )}

                      <div className="parameters-grid">
                        <div>
                          <label>STAKE (USD)</label>
                          <input
                            type="number"
                            value={strat.stake}
                            disabled={!isHighPriority}
                            onChange={(e) =>
                              handleInputChange(
                                strat.id,
                                'stake',
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                        <div>
                          <label>STOP LOSS</label>
                          <input
                            type="number"
                            value={strat.stopLoss}
                            disabled={!isHighPriority}
                            onChange={(e) =>
                              handleInputChange(
                                strat.id,
                                'stopLoss',
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                        <div>
                          <label>TAKE PROFIT</label>
                          <input
                            type="number"
                            value={strat.takeProfit}
                            disabled={!isHighPriority}
                            onChange={(e) =>
                              handleInputChange(
                                strat.id,
                                'takeProfit',
                                Number(e.target.value)
                              )
                            }
                          />
                        </div>
                      </div>

                      <button
                        className={`btn-primary ${!isHighPriority ? 'btn-disabled' : ''}`}
                        disabled={!isHighPriority}
                        onClick={(e) => handleLoadStrategy(strat, e)}
                      >
                        📥 LOAD STRATEGY PARAMETERS
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
