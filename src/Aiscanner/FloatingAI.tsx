// src/Aiscanner/FloatingAI.tsx

import React, { useEffect, useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { CORE_7_STRATEGIES } from './strategies';
import { ScannerBridge } from './scannerBridge';
import './FloatingAI.css';

export const FloatingAI: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [strategies, setStrategies] = useState(CORE_7_STRATEGIES);
  const nodeRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<ScannerBridge | null>(null);

  useEffect(() => {
    // Start Web Worker background scanner
    bridgeRef.current = new ScannerBridge((data) => {
      if (data && data.length > 0) {
        setStrategies(data);
      }
    });
    bridgeRef.current.startScanner();

    return () => {
      bridgeRef.current?.stopScanner();
    };
  }, []);

  // Handle click explicitly to prevent react-draggable from stealing click
  const handleOrbClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  return (
    <Draggable nodeRef={nodeRef} bounds="window" handle=".drag-handle">
      <div
        className="tredascore-scanner-root"
        ref={nodeRef}
        style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 99999,
          pointerEvents: 'auto',
        }}
      >
        {/* Header Container */}
        <div className="scanner-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="scanner-title-area">
            <h3 style={{ margin: 0, color: '#ffffff' }}>AI Multi-Asset Scanner</h3>
          </div>

          {/* Clickable AI Orb Button */}
          <div
            className="ai-orb-wrapper"
            onClick={handleOrbClick}
            onMouseDown={(e) => e.stopPropagation()} // Prevents drag start on click
            title="Click to toggle scanner panel"
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            <div className="ring-pulse"></div>
            <div className="ai-orb">AI</div>
          </div>
        </div>

        {/* Collapsible Panel */}
        {isOpen && (
          <div className="scanner-body" style={{ background: '#1e1e2d', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
            {strategies.map((strat) => (
              <div key={strat.id} style={{ color: '#fff', padding: '6px 0', borderBottom: '1px solid #333' }}>
                <strong>{strat.name}</strong> - {strat.symbol} ({strat.direction})
              </div>
            ))}
          </div>
        )}

        {/* Dedicated Drag Footer Handle */}
        <div
          className="drag-handle-footer drag-handle"
          title="Drag to move"
          style={{ cursor: 'grab', textAlign: 'center', padding: '6px', background: '#111', borderRadius: '0 0 8px 8px' }}
        >
          <div className="drag-dots" style={{ color: '#888', fontSize: '12px' }}>⋮⋮ Drag Scanner</div>
        </div>
      </div>
    </Draggable>
  );
};

export default FloatingAI;
