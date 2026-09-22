import React, { useEffect, useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { ScannerBridge } from './scannerBridge';
import './FloatingAI.css';

export interface StrategyItem {
  id: string;
  name: string;
  symbol: string;
  type: string;
  variant: string;
  confidence: number;
  score: number;
  badgeLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  direction: 'RISE' | 'FALL' | 'READY';
  parameters: {
    stake: number;
    stopLoss: number;
    takeProfit: number;
  };
}

export const FloatingAI: React.FC = () => {
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editParams, setEditParams] = useState<{ stake: number; stopLoss: number; takeProfit: number }>({
    stake: 3,
    stopLoss: 4,
    takeProfit: 8,
  });

  const nodeRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<ScannerBridge | null>(null);

  useEffect(() => {
    // Instantiate background bridge
    bridgeRef.current = new ScannerBridge((incomingData: StrategyItem[]) => {
      setStrategies((prev) => {
        // LOCK ORDER IF USER IS CURRENTLY EDITING PARAMETERS
        if (editingId !== null) {
          return prev.map((oldStrat) => {
            const updatedMatch = incomingData.find((item) => item.id === oldStrat.id);
            return updatedMatch ? { ...oldStrat, confidence: updatedMatch.confidence, score: updatedMatch.score } : oldStrat;
          });
        }

        // OTHERWISE SORT LIVE BY CONFIDENCE (HIGHEST FIRST)
        return [...incomingData].sort((a, b) => b.confidence - a.confidence);
      });
    });

    bridgeRef.current.startScanner();

    return () => {
      bridgeRef.current?.stopScanner();
    };
  }, [editingId]);

  const handleStartEditing = (strat: StrategyItem) => {
    setEditingId(strat.id);
    setEditParams({ ...strat.parameters });
  };

  const handleCancelEditing = () => {
    setEditingId(null);
  };

  const handleApplyToBlockly = (stratId: string) => {
    // Inject parameters into workspace/Blockly session
    console.log(`Injecting parameters for ${stratId} into Blockly:`, editParams);
    
    // Dispatch custom event for Blockly workspace listeners
    const event = new CustomEvent('DERIV_BLOCKLY_LOAD_STRATEGY', {
      detail: {
        strategyId: stratId,
        params: editParams,
      },
    });
    window.dispatchEvent(event);

    // Release order lock
    setEditingId(null);
  };

  return (
    <Draggable nodeRef={nodeRef} bounds="window" handle=".drag-handle">
      <div className="tredascore-scanner-root" ref={nodeRef}>
        {/* Header with Dancing Orb */}
        <div className="scanner-header">
          <div className="scanner-title-area">
            <h3>AI Multi-Asset Scanner</h3>
            {editingId && <span className="lock-badge">Order Locked</span>}
          </div>
          
          <div className="ai-orb-wrapper">
            <div className="ring-pulse"></div>
            <div className="ring-pulse delay-1"></div>
            <div className="ring-pulse delay-2"></div>
            <div className="ai-orb">AI</div>
          </div>
        </div>

        {/* Strategy List */}
        <div className="scanner-body">
          {strategies.map((strat, index) => {
            const isEditing = editingId === strat.id;
            const isTopWinner = index === 0;

            return (
              <div
                key={strat.id}
                className={`strategy-card ${isTopWinner ? 'is-top-winner' : ''}`}
              >
                <div className="strategy-header-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="strategy-rank">#{index + 1}</span>
                    <h4 className="strategy-title">{strat.name}</h4>
                  </div>
                  <span className={`confidence-pill ${strat.badgeLevel.toLowerCase()}`}>
                    {(strat.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="strategy-meta-row">
                  <span className="asset-badge">{strat.symbol}</span>
                  <span>{strat.type}</span>
                  <span className="type-badge">{strat.variant}</span>
                </div>

                {isEditing ? (
                  <div className="param-editor-panel">
                    <div className="input-grid">
                      <div className="field-group">
                        <label>Stake ($)</label>
                        <input
                          type="number"
                          value={editParams.stake}
                          onChange={(e) => setEditParams({ ...editParams, stake: Number(e.target.value) })}
                        />
                      </div>
                      <div className="field-group">
                        <label>Stop Loss</label>
                        <input
                          type="number"
                          value={editParams.stopLoss}
                          onChange={(e) => setEditParams({ ...editParams, stopLoss: Number(e.target.value) })}
                        />
                      </div>
                      <div className="field-group">
                        <label>Take Profit</label>
                        <input
                          type="number"
                          value={editParams.takeProfit}
                          onChange={(e) => setEditParams({ ...editParams, takeProfit: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    <div className="editor-actions">
                      <button
                        className="btn-submit-blockly"
                        onClick={() => handleApplyToBlockly(strat.id)}
                      >
                        LOAD BOT PARAMETERS
                      </button>
                      <button className="btn-cancel-edit" onClick={handleCancelEditing}>
                        CANCEL
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn-load-strategy"
                    onClick={() => handleStartEditing(strat)}
                  >
                    📥 EDIT & LOAD PARAMETERS
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Drag Handle */}
        <div className="drag-handle-footer drag-handle" title="Drag to move">
          <div className="drag-dots"></div>
        </div>
      </div>
    </Draggable>
  );
};
