// src/Aiscanner/FloatingAI.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import './FloatingAI.css';
import { CORE_7_STRATEGIES, StrategyConfig } from './strategies';
import { scannerLogic } from './scannerLogic';
import { useDerivTicks, ASSET_TO_SYMBOL } from './useDerivTicks';

export const FloatingAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  // Initialize strategy list with single HIGH priority enforced
  const [strategiesList, setStrategiesList] = useState<StrategyConfig[]>(() => {
    return scannerLogic.setStrategies(CORE_7_STRATEGIES);
  });

  // Extract assets memoized safely for hook dependency
  const assets = useMemo(() => CORE_7_STRATEGIES.map((s) => s.asset), []);
  const { ticksBuffer } = useDerivTicks(assets);

  // Track drag distance to differentiate tap vs drag
  const dragDistanceRef = useRef(0);

  // Re-evaluate strategy confidence scores on every tick update
  useEffect(() => {
    if (!ticksBuffer || Object.keys(ticksBuffer).length === 0) return;

    // Evaluate live signals across strategies
    const updatedList = scannerLogic.evaluateAndProcessTicks(ticksBuffer, ASSET_TO_SYMBOL);
    
    // Force state update to trigger immediate UI re-render
    setStrategiesList([...updatedList]);

    // Auto-expand HIGH strategy card if no card is manually selected
    const currentHigh = updatedList.find((s) => s.priority === 'HIGH');
    if (currentHigh && !expandedId) {
      setExpandedId(currentHigh.id);
    }
  }, [ticksBuffer, expandedId]);

  const toggleModal = () => {
    setIsOpen((prev) => {
      const nextState = !prev;
      if (nextState) {
        const highStrat = strategiesList.find((s) => s.priority === 'HIGH');
        setExpandedId(highStrat ? highStrat.id : null);
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

  // Update strategy parameters in state
  const handleInputChange = (
    stratId: string,
    field: 'stake' | 'stopLoss' | 'takeProfit',
    value: number
  ) => {
    const updated = scannerLogic.updateStrategyParams(stratId, { [field]: value });
    setStrategiesList([...updated]);
  };

  // Safe Parameter Injection directly into Blockly Workspace
  const handleLoadStrategy = (strat: StrategyConfig, e: React.MouseEvent) => {
    e.stopPropagation();

    if (strat.priority !== 'HIGH') {
      alert('Only the strategy marked as HIGH priority can be loaded into Blockly.');
      return;
    }

    const success = scannerLogic.loadHighStrategyToWorkspace(strat.id);
    if (success) {
      setIsOpen(false);
    } else {
      alert('Failed to load strategy. Make sure the Deriv Bot workspace is open.');
    }
  };

  // Dynamic Global Metrics based on top-performing HIGH strategy in state
  const highStrategy = strategiesList.find((s) => s.priority === 'HIGH') || strategiesList[0];
  const globalWinnerName = highStrategy?.name || 'ANALYZING...';
  const globalDirection = highStrategy?.direction || 'HOLD';
  const globalConfidence = highStrategy?.confidence ?? 50;

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
              <span className="metric-value green">
                {globalWinnerName}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-label">DIRECTION</span>
              <span className={`metric-value ${globalDirection === 'RISE' ? 'green' : globalDirection === 'FALL' ? 'orange' : ''}`}>
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

              const score = strat.score ?? 50;
              const confidence = strat.confidence ?? 50;

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
                        Score {score}% · Confidence {confidence}% · Direction: {strat.direction || 'HOLD'}
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
