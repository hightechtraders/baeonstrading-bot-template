// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx (PART 1)
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
import { ScannerBridge } from './scannerBridge';
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { useScannerFeed } from './useScannerFeed'; 
import './FloatingAI.css';

export const FloatingAI: React.FC = () => {
  useScannerFeed();

  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  
  const [signalBannerText, setSignalBannerText] = useState<string>("🔍 Listening for Live Multi-Market Ticks...");
  const [isSignalLocked, setIsSignalLocked] = useState<boolean>(false);
  const [isSweetSpot, setIsSweetSpot] = useState<boolean>(false);
  const [isScanningPhase, setIsScanningPhase] = useState<boolean>(true);

  const [sessionRuns, setSessionRuns] = useState<number>(0);
  const MAX_RUNS_PER_SESSION = 6;

  const isOpenRef = useRef<boolean>(false);
  const isScanningPhaseRef = useRef<boolean>(true);
  const sweetSpotStreakRef = useRef<number>(0);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { isScanningPhaseRef.current = isScanningPhase; }, [isScanningPhase]);

  useEffect(() => {
    const handleStrategiesUpdated = (e: CustomEvent) => {
      const updated = e.detail?.strategies;
      if (Array.isArray(updated) && updated.length > 0) {
        setStrategies(updated);

        if (isOpenRef.current && !isScanningPhaseRef.current && !isSignalLocked) {
          const sorted = [...updated].sort((a, b) => b.confidence - a.confidence);
          
          // FIXED: Wrapped with element zero [0] extractor to pull the object, not the full array reference pointer
          const topStrat = sorted[0]; 

          // High conviction triggers supported smoothly past 96%
          const isHighConviction = topStrat && topStrat.confidence >= 78;

          if (isHighConviction) {
            sweetSpotStreakRef.current += 1;
            if (sweetSpotStreakRef.current >= 2) {
              setSignalBannerText(`🎯 HIGH MOMENTUM SWEET SPOT: ${topStrat.name} (${topStrat.market}) at ${topStrat.confidence}%! Ready to Load & Run.`);
              setIsSweetSpot(true);
            }
          } else {
            sweetSpotStreakRef.current = 0;
            setSignalBannerText("✅ Market Scan Complete: Strategies Ranked");
            setIsSweetSpot(false);
          }
        }
      }
    };

    const handleSignalLock = (e: CustomEvent) => {
      if (isOpenRef.current && !isScanningPhaseRef.current) {
        setSignalBannerText(e.detail?.message || "🎯 HIGH CONFIDENCE LOCKED: Ready to Load Strategy");
        setIsSignalLocked(true);
        setIsSweetSpot(false);
      }
    };

    window.addEventListener('ai-strategies-updated' as any, handleStrategiesUpdated as EventListener);
    window.addEventListener('ai-signal-locked', handleSignalLock as EventListener);

    return () => {
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
      setSignalBannerText("🔍 Scanning Live Ticks Across Markets...");

      const timer = setTimeout(() => {
        setIsScanningPhase(false);
        setSignalBannerText("✅ Market Scan Complete: Strategies Ranked");
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);
// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx (PART 2)
// ==========================================

  const sortedStrategies = [...strategies].sort((a, b) => b.confidence - a.confidence);

  const handleRunBot = (strat: Strategy) => {
    if (sessionRuns >= MAX_RUNS_PER_SESSION) {
        setSignalBannerText("⚠️ CRITICAL DRAWDOWN SHIELD: Session limit of 6 runs reached!");
        return;
    }

    setSessionRuns(prev => prev + 1);
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
      <button className="dancing-orb-wrapper" onClick={() => setIsOpen(true)}>
        <div className="dancing-orb-inner">🤖 AI</div>
      </button>

      {isOpen && (
        <div className="ai-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h2>AI Multi-Asset Scanner</h2>
              <div className="session-tracker-pill" style={{ fontSize: '12px', background: '#2d3748', padding: '4px 8px', borderRadius: '12px' }}>
                Runs: {sessionRuns} / {MAX_RUNS_PER_SESSION} Used
              </div>
              <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            <div id="ai-signal-banner" className={`signal-banner ${isSignalLocked ? 'locked' : isSweetSpot ? 'sweet-spot' : ''}`}>
              {signalBannerText}
            </div>

            {isScanningPhase ? (
              <div className="scanner-loading-state">
                <div className="spinner-animation">🛰️</div>
                <p className="loading-title">Analyzing tick streams across Volatility indices...</p>
                <p className="loading-sub">Evaluating momentum, spreads, and historical confidence layers.</p>
              </div>
            ) : (
              <>
                <p className="scanner-instruction">Top balanced strategies ranked below. Click to load and execute instantly.</p>

                <div className="strategy-list">
                  {sortedStrategies.map((strat, idx) => {
                    const key = strat.id || `${strat.name}-${idx}`;
                    const isGlobalWinner = idx === 0;
                    const isSessionCapBreached = sessionRuns >= MAX_RUNS_PER_SESSION;

                    return (
                      <div key={key} className={`strategy-card ${isGlobalWinner ? 'top-card' : ''}`}>
                        {isGlobalWinner && (
                          <div className="global-winner-meta">
                            <span>⭐ GLOBAL WINNER</span>
                            <span>CONFIDENCE {strat.confidence}%</span>
                          </div>
                        )}

                        <div className="card-main-row">
                          <span className="badge-rank">#{idx + 1}</span>
                          <div className="strategy-info">
                            <strong>{strat.name}</strong>
                            <div className="card-tags-row">
                              <span className="market-tag">{strat.market}</span>
                              {strat.direction && <span className={`direction-tag ${strat.direction.toLowerCase()}`}>{strat.direction}</span>}
                            </div>
                          </div>
                          <span className={isGlobalWinner ? "badge-high" : "badge-medium"}>
                            {isGlobalWinner ? "HIGH" : "MEDIUM"}
                          </span>
                        </div>

                        <div className="card-sub-row">
                          <span>Score: {strat.score || strat.confidence}%</span>
                          <span>Confidence: {strat.confidence}%</span>
                        </div>

                        <button 
                          className="run-manual-btn" 
                          onClick={() => handleRunBot(strat)}
                          disabled={isSessionCapBreached}
                          style={isSessionCapBreached ? { background: '#4a5568', cursor: 'not-allowed' } : {}}
                        >
                          {isSessionCapBreached ? 'Session Limit Reached (6 Runs)' : 'Load Strategy & Run Instantly'}
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
