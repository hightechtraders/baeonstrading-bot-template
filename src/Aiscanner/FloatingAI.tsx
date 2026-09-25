// src/Aiscanner/FloatingAI.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Draggable, { DraggableData, DraggableEvent } from 'react-draggable';
import './FloatingAI.css';
import { CORE_7_STRATEGIES, StrategyConfig } from './strategies';
import { scannerLogic } from './scannerLogic';
import { useDerivTicks, ASSET_TO_SYMBOL } from './useDerivTicks';

const ENABLE_SIMULATION = true;

export const FloatingAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const [strategiesList, setStrategiesList] = useState<StrategyConfig[]>(() => {
    return scannerLogic.setStrategies(CORE_7_STRATEGIES);
  });

  const assets = useMemo(() => CORE_7_STRATEGIES.map((s) => s.asset), []);
  const { ticksBuffer: realTicksBuffer } = useDerivTicks(assets);

  const [activeBuffer, setActiveBuffer] = useState<Record<string, number[]>>({});
  const dragDistanceRef = useRef(0);

  const strategiesListRef = useRef(strategiesList);
  strategiesListRef.current = strategiesList;

  // 1. Tick Stream Switcher
  useEffect(() => {
    if (ENABLE_SIMULATION) {
      const simPrices: Record<string, number[]> = {};

      const simInterval = setInterval(() => {
        CORE_7_STRATEGIES.forEach((strat) => {
          const key = strat.asset;
          const currentSeries = simPrices[key] || Array.from({ length: 10 }, () => 1000);
          const lastPrice = currentSeries[currentSeries.length - 1];
          
          const newPrice = Number((lastPrice + (Math.random() - 0.48) * 5).toFixed(2));
          simPrices[key] = [...currentSeries, newPrice].slice(-30);
        });

        setActiveBuffer({ ...simPrices });
      }, 1000);

      return () => clearInterval(simInterval);
    } else {
      setActiveBuffer(realTicksBuffer);
    }
  }, [realTicksBuffer]);

  // 2. Process Ticks smoothly (FREEZE all metrics & updates completely when editing)
  useEffect(() => {
    if (!activeBuffer || Object.keys(activeBuffer).length === 0) return;

    // Completely skip state updates while any card is expanded
    if (expandedId !== null) return;

    const updatedList = scannerLogic.evaluateAndProcessTicks(
      activeBuffer,
      ASSET_TO_SYMBOL,
      false,
      null
    );
    
    const hasChanged = updatedList.some((newStrat, i) => {
      const oldStrat = strategiesListRef.current[i];
      return (
        !oldStrat ||
        oldStrat.score !== newStrat.score ||
        oldStrat.confidence !== newStrat.confidence ||
        oldStrat.direction !== newStrat.direction ||
        oldStrat.priority !== newStrat.priority
      );
    });

    if (hasChanged) {
      setStrategiesList(updatedList);
    }
  }, [activeBuffer, expandedId]);

  const toggleModal = () => {
    setIsOpen((prev) => !prev);
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

  const handleInputChange = (
    stratId: string,
    field: 'stake' | 'stopLoss' | 'takeProfit',
    value: number
  ) => {
    const updated = scannerLogic.updateStrategyParams(stratId, { [field]: value });
    setStrategiesList(updated);
  };

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
            <span className="pulse-ring ring-1" />
            <span className="pulse-ring ring-2" />
            <div className="ai-btn-glow" />
            <div className="ai-btn-content">
              <span className="ai-btn-text">AI</span>
            </div>
            <span className="live-status-dot" />
          </button>
        </div>
      </Draggable>

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
              <span className="metric-value green">{globalWinnerName}</span>
            </div>
            <div className="metric-box">
              <span className="metric-label">DIRECTION</span>
              <span
                className={`metric-value ${
                  globalDirection === 'UP' || globalDirection === 'RISE'
                    ? 'green'
                    : globalDirection === 'DOWN' || globalDirection === 'FALL'
                    ? 'orange'
                    : ''
                }`}
              >
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
