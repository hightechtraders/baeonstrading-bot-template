// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx
// ==========================================
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScannerBridge } from './scannerBridge';
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { useScannerFeed } from './useScannerFeed'; 
import { ScannerTickerBar } from './ScannerTickerBar'; 
import './FloatingAI.css';

export const FloatingAI: React.FC = () => {
  useScannerFeed();

  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  
  const [signalBannerText, setSignalBannerText] = useState<string>("🔍 Listening for Live R_10 Ticks...");
  const [isSignalLocked, setIsSignalLocked] = useState<boolean>(false);
  const [isSweetSpot, setIsSweetSpot] = useState<boolean>(false);
  const [isScanningPhase, setIsScanningPhase] = useState<boolean>(true);

  // Refs for zero-latency drag tracking without re-triggering React renders on every pixel move
  const orbRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
  const isDraggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);

  const isOpenRef = useRef<boolean>(false);
  const isScanningPhaseRef = useRef<boolean>(true);
  const sweetSpotStreakRef = useRef<number>(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isScanningPhaseRef.current = isScanningPhase;
  }, [isScanningPhase]);

  // Initialize position via DOM ref on mount
  useEffect(() => {
    if (orbRef.current) {
      orbRef.current.style.left = `${posRef.current.x}px`;
      orbRef.current.style.top = `${posRef.current.y}px`;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    
    dragOffsetRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y
    };
    
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !orbRef.current) return;

    const dx = e.clientX - posRef.current.x - dragOffsetRef.current.x;
    const dy = e.clientY - posRef.current.y - dragOffsetRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedRef.current = true;
    }

    const elementWidth = orbRef.current.offsetWidth || 60;
    const elementHeight = orbRef.current.offsetHeight || 60;
    const padding = 12;

    // Strict boundary math clamping
    const newX = Math.max(padding, Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - elementWidth - padding));
    const newY = Math.max(padding, Math.min(e.clientY - dragOffsetRef.current.y, window.innerHeight - elementHeight - padding));

    posRef.current = { x: newX, y: newY };

    // Direct DOM mutation for buttery smooth 60/120fps tracking without React reconciliation lag
    orbRef.current.style.left = `${newX}px`;
    orbRef.current.style.top = `${newY}px`;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handleClick = useCallback(() => {
    if (!hasMovedRef.current) {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    const handleStrategiesUpdated = (e: CustomEvent) => {
      const updated = e.detail?.strategies || e.detail?.updatedStrategies;
      if (Array.isArray(updated) && updated.length > 0) {
        setStrategies(updated);

        if (isOpenRef.current && !isScanningPhaseRef.current && !isSignalLocked) {
          const sorted = [...updated].sort((a, b) => b.confidence - a.confidence);
          const topStrat = sorted[0];
          const isHighConviction = topStrat && topStrat.confidence >= 78 && topStrat.confidence <= 96;

          if (isHighConviction) {
            sweetSpotStreakRef.current += 1;
            if (sweetSpotStreakRef.current >= 2) {
              setSignalBannerText(`🎯 HIGH MOMENTUM: ${topStrat.name} at ${topStrat.confidence}%! Ready to Load & Run.`);
              setIsSweetSpot(true);
            }
          } else {
            sweetSpotStreakRef.current = 0;
            setSignalBannerText("✅ R_10 Momentum Scan Active");
            setIsSweetSpot(false);
          }
        }
      }
    };

    const handleSignalLock = (e: CustomEvent) => {
      if (isOpenRef.current && !isScanningPhaseRef.current) {
        setSignalBannerText(e.detail?.message || "🎯 HIGH CONFIDENCE LOCKED: Ready to Execute");
        setIsSignalLocked(true);
        setIsSweetSpot(false);
      }
    };

    window.addEventListener('ai-tick-received' as any, handleStrategiesUpdated as EventListener);
    window.addEventListener('deriv_scanner_updated' as any, handleStrategiesUpdated as EventListener);
    window.addEventListener('ai-strategies-updated' as any, handleStrategiesUpdated as EventListener);
    window.addEventListener('ai-signal-locked', handleSignalLock as EventListener);

    return () => {
      window.removeEventListener('ai-tick-received' as any, handleStrategiesUpdated as EventListener);
      window.removeEventListener('deriv_scanner_updated' as any, handleStrategiesUpdated as EventListener);
      window.removeEventListener('ai-strategies-updated' as any, handleStrategiesUpdated as EventListener);
      window.removeEventListener('ai-signal-locked', handleSignalLock as EventListener);
    };
  }, [isSignalLocked]);

  useEffect(() => {
    if (isOpen) {
      setIsSignalLocked(false);
      setIsSweetSpot(false);
      setIsScanningPhase(true);
      sweetSpotStreakRef.current = 0;
      setSignalBannerText("🔍 Calibrating R_10 Alpha Ticks...");

      const timer = setTimeout(() => {
        setIsScanningPhase(false);
        setSignalBannerText("✅ R_10 Momentum Scan Active");
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const sortedStrategies = [...strategies].sort((a, b) => b.confidence - a.confidence);

  const handleRunBot = (strat: Strategy) => {
    ScannerBridge.loadStrategyToWorkspace(strat);
    setIsOpen(false);

    setTimeout(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const targetRunBtn = allButtons.find(b => b.textContent?.trim() === 'Run');
      
      if (targetRunBtn instanceof HTMLElement) {
        targetRunBtn.click();
      }
    }, 100);
  };

  return (
    <div className="floating-ai-container">
      <div 
        ref={orbRef}
        className="dancing-orb-wrapper"
        style={{
          position: 'fixed',
          touchAction: 'none',
          cursor: 'grab',
          zIndex: 9999
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        <div className="dancing-orb-inner">
          🤖 AI
        </div>
      </div>

      {isOpen && (
        <div className="ai-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h2>R-10 Institutional Alpha Engine</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            <ScannerTickerBar />

            <div 
              id="ai-signal-banner"
              className={`signal-banner ${isSignalLocked ? 'locked' : isSweetSpot ? 'sweet-spot' : ''}`}
            >
              {signalBannerText}
            </div>

            {isScanningPhase ? (
              <div className="scanner-loading-state">
                <div className="spinner-animation">🛰️</div>
                <p className="loading-title">Syncing with Volatility 10 Index feed...</p>
                <p className="loading-sub">Calculating live Bullish/Bearish quant alpha metrics.</p>
              </div>
            ) : (
              <>
                <p className="scanner-instruction">Core directional alpha strategies tracking R_10. Click to load and execute.</p>

                <div className="strategy-list">
                  {sortedStrategies.map((strat, idx) => {
                    const key = strat.id || `${strat.name}-${idx}`;
                    const isDominant = idx === 0;

                    return (
                      <div 
                        key={key} 
                        className={`strategy-card ${isDominant ? 'top-card' : ''}`}
                      >
                        {isDominant && (
                          <div className="global-winner-meta">
                            <span>⭐ DOMINANT ALPHA</span>
                            <span>CONFIDENCE {strat.confidence}%</span>
                          </div>
                        )}

                        <div className="card-main-row">
                          <span className="badge-rank">#{idx + 1}</span>
                          <div className="strategy-info">
                            <strong>{strat.name}</strong>
                            <div className="card-tags-row">
                              <span className="market-tag">{strat.market}</span>
                              {strat.direction && (
                                <span className={`direction-tag ${strat.direction.toLowerCase()}`}>
                                  {strat.direction}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={isDominant ? "badge-high" : "badge-medium"}>
                            {isDominant ? "ACTIVE" : "STANDBY"}
                          </span>
                        </div>

                        <div className="card-sub-row">
                          <span>Alpha Score: {strat.score || strat.confidence}%</span>
                          <span>Confidence: {strat.confidence}%</span>
                        </div>

                        <button 
                          className="run-manual-btn" 
                          onClick={() => handleRunBot(strat)}
                        >
                          Load {strat.name} & Run Instantly
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
