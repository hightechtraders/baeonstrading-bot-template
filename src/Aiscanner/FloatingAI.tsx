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

  // Physics & Drag Refs
  const orbRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<{ x: number; y: number }>({ x: window.innerWidth - 80, y: window.innerHeight - 100 });
  const velocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const lastMousePosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const animFrameRef = useRef<number | null>(null);

  const isOpenRef = useRef<boolean>(false);
  const isScanningPhaseRef = useRef<boolean>(true);
  const sweetSpotStreakRef = useRef<number>(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isScanningPhaseRef.current = isScanningPhase;
  }, [isScanningPhase]);

  // Initialize position on mount
  useEffect(() => {
    if (orbRef.current) {
      orbRef.current.style.left = `${posRef.current.x}px`;
      orbRef.current.style.top = `${posRef.current.y}px`;
    }
  }, []);

  const stopInertia = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    stopInertia();
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    
    dragOffsetRef.current = {
      x: e.clientX - posRef.current.x,
      y: e.clientY - posRef.current.y
    };

    lastMousePosRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now()
    };

    velocityRef.current = { vx: 0, vy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !orbRef.current) return;

    const now = performance.now();
    const dt = now - lastMousePosRef.current.time;

    if (dt > 0) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasMovedRef.current = true;
      }

      velocityRef.current = {
        vx: (dx / dt) * 16,
        vy: (dy / dt) * 16
      };

      lastMousePosRef.current = { x: e.clientX, y: e.clientY, time: now };
    }

    const elementWidth = orbRef.current.offsetWidth || 60;
    const elementHeight = orbRef.current.offsetHeight || 60;
    const padding = 12;

    const newX = Math.max(padding, Math.min(e.clientX - dragOffsetRef.current.x, window.innerWidth - elementWidth - padding));
    const newY = Math.max(padding, Math.min(e.clientY - dragOffsetRef.current.y, window.innerHeight - elementHeight - padding));

    posRef.current = { x: newX, y: newY };
    orbRef.current.style.left = `${newX}px`;
    orbRef.current.style.top = `${newY}px`;
  }, []);

  const startInertia = () => {
    const orb = orbRef.current;
    if (!orb) return;

    let { vx, vy } = velocityRef.current;
    const friction = 0.92;
    const elementWidth = orb.offsetWidth || 60;
    const elementHeight = orb.offsetHeight || 60;
    const padding = 12;

    const step = () => {
      if (isDraggingRef.current) return;

      vx *= friction;
      vy *= friction;

      if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        return;
      }

      let nextX = posRef.current.x + vx;
      let nextY = posRef.current.y + vy;

      const minX = padding;
      const maxX = window.innerWidth - elementWidth - padding;
      const minY = padding;
      const maxY = window.innerHeight - elementHeight - padding;

      if (nextX <= minX || nextX >= maxX) {
        vx = 0;
        nextX = Math.max(minX, Math.min(nextX, maxX));
      }
      if (nextY <= minY || nextY >= maxY) {
        vy = 0;
        nextY = Math.max(minY, Math.min(nextY, maxY));
      }

      posRef.current = { x: nextX, y: nextY };
      orb.style.left = `${nextX}px`;
      orb.style.top = `${nextY}px`;

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
  };

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    startInertia();
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
      {/* GPU-accelerated smooth animations with sub-pixel jitter fix */}
      <style>{`
        @keyframes vividPulseCyan {
          0% { transform: scale3d(1, 1, 1); opacity: 0.9; }
          100% { transform: scale3d(1.8, 1.8, 1); opacity: 0; }
        }
        @keyframes vividPulsePaleGreen {
          0% { transform: scale3d(1, 1, 1); opacity: 0.85; }
          100% { transform: scale3d(2.1, 2.1, 1); opacity: 0; }
        }
        @keyframes vividPulseOuter {
          0% { transform: scale3d(1, 1, 1); opacity: 0.7; }
          100% { transform: scale3d(2.5, 2.5, 1); opacity: 0; }
        }
        @keyframes silkySlowFloat {
          0%, 100% { transform: translate3d(0, 0px, 0); }
          50% { transform: translate3d(0, -9px, 0); }
        }
      `}</style>

      {/* Physics Wrapper: Strictly handles coordinate placement with zero animation interference */}
      <div 
        ref={orbRef}
        className="dancing-orb-wrapper"
        style={{
          position: 'fixed',
          touchAction: 'none',
          cursor: 'grab',
          zIndex: 9999,
          willChange: 'left, top',
          width: '60px',
          height: '60px',
          aspectRatio: '1 / 1',
          boxSizing: 'border-box',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onClick={handleClick}
      >
        {/* Floating Container: Silk-smooth GPU-accelerated vertical motion */}
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'silkySlowFloat 4.5s infinite ease-in-out',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          pointerEvents: 'none'
        }}>
          {/* Ring 1: Vivid Cyan Inner Pulse Ring */}
          <div style={{
            position: 'absolute',
            inset: '-12px',
            borderRadius: '50%',
            border: '2px solid rgba(0, 242, 254, 0.85)',
            animation: 'vividPulseCyan 3s infinite cubic-bezier(0.4, 0, 0.6, 1)',
            backfaceVisibility: 'hidden',
            pointerEvents: 'none',
            boxSizing: 'border-box'
          }} />

          {/* Ring 2: Pale Green Neon Mid Pulse Ring */}
          <div style={{
            position: 'absolute',
            inset: '-24px',
            borderRadius: '50%',
            border: '2px solid rgba(152, 255, 152, 0.75)',
            animation: 'vividPulsePaleGreen 3.6s infinite cubic-bezier(0.4, 0, 0.6, 1) 0.9s',
            backfaceVisibility: 'hidden',
            pointerEvents: 'none',
            boxSizing: 'border-box'
          }} />

          {/* Ring 3: Outer Cyan/Green Expansion Ring */}
          <div style={{
            position: 'absolute',
            inset: '-36px',
            borderRadius: '50%',
            border: '1.5px solid rgba(0, 255, 170, 0.5)',
            animation: 'vividPulseOuter 4.2s infinite cubic-bezier(0.4, 0, 0.6, 1) 1.8s',
            backfaceVisibility: 'hidden',
            pointerEvents: 'none',
            boxSizing: 'border-box'
          }} />

          {/* Core Solid Circular Orb */}
          <div 
            className="dancing-orb-inner"
            style={{
              width: '100%',
              height: '100%',
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              position: 'relative',
              zIndex: 2,
              pointerEvents: 'auto',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'radial-gradient(circle at 35% 35%, #34d399 0%, #00a86b 45%, #022c22 100%)',
              boxShadow: 'inset 0 6px 12px rgba(255, 255, 255, 0.45), inset 0 -8px 14px rgba(0, 0, 0, 0.6), 0 0 35px rgba(0, 242, 254, 0.6)',
              border: '2px solid rgba(255, 255, 255, 0.5)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '15px'
            }}
          >
            🤖 AI
          </div>
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
