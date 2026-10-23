// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
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

  const isOpenRef = useRef<boolean>(false);
  const isScanningPhaseRef = useRef<boolean>(true);
  const sweetSpotStreakRef = useRef<number>(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isScanningPhaseRef.current = isScanningPhase;
  }, [isScanningPhase]);

  useEffect(() => {
    const handleStrategiesUpdated = (e: CustomEvent) => {
      const updated = e.detail?.strategies;
      if (Array.isArray(updated) && updated.length > 0) {
        setStrategies(updated);

        if (
          isOpenRef.current && 
          !isScanningPhaseRef.current && 
          !isSignalLocked
        ) {
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
      setSignalBannerText("🔍 Calibrating R_10 Alpha Ticks...");

      const timer = setTimeout(() => {
        setIsScanningPhase(false);
        setSignalBannerText("✅ R_10 Momentum Scan Active");
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const sortedStrategies = [...strategies].sort((a, b) => b.confidence - a.confidence);

  // Instantly loads the strategy and triggers the workspace Run button simultaneously
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
      <button 
        className="dancing-orb-wrapper"
        onClick={() => setIsOpen(true)}
      >
        <div className="dancing-orb-inner">
          🤖 AI
        </div>
      </button>

      {isOpen && (
        <div className="ai-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h2>R-10 Institutional Alpha Engine</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            {/* Live Mini Price Ticker Bar */}
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
