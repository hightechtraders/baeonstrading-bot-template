// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx
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
  
  const [signalBannerText, setSignalBannerText] = useState<string>("🔍 Listening for Live Deriv Ticks...");
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

          const isHighConviction = topStrat && topStrat.confidence >= 80 && topStrat.confidence <= 89;

          if (isHighConviction) {
            sweetSpotStreakRef.current += 1;
            if (sweetSpotStreakRef.current >= 2) {
              setSignalBannerText(`🎯 HIGH MOMENTUM SWEET SPOT: ${topStrat.name} (${topStrat.market}) at ${topStrat.confidence}%! Ready to Load.`);
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
        setSignalBannerText(e.detail?.message || "🎯 90%+ HIGH CONFIDENCE LOCKED: Ready to Load Strategy");
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

  const sortedStrategies = [...strategies].sort((a, b) => b.confidence - a.confidence);

  const handleRunBot = (strat: Strategy) => {
    ScannerBridge.loadStrategyToWorkspace(strat);
    alert(`Strategy "${strat.name}" successfully loaded! Click the main platform run button to execute.`);
    setIsOpen(false);
  };

  return (
    <div className="floating-ai-container" style={{ display: 'contents' }}>
      <button 
        className="dancing-orb-wrapper"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer'
        }}
      >
        <div className="dancing-orb-inner">
          🤖 AI
        </div>
      </button>

      {isOpen && (
        <div className="ai-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <h2>AI Multi-Asset Scanner</h2>
              <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
            
            <div 
              id="ai-signal-banner"
              style={{
                background: isSignalLocked 
                  ? 'rgba(46, 212, 121, 0.15)' 
                  : isSweetSpot 
                  ? 'rgba(245, 158, 11, 0.2)' 
                  : '#141824',
                border: `1px solid ${isSignalLocked ? '#2ed479' : isSweetSpot ? '#f59e0b' : '#1e2335'}`,
                borderRadius: '8px',
                padding: '10px 14px',
                margin: '10px 0 16px 0',
                color: isSignalLocked ? '#2ed479' : isSweetSpot ? '#f59e0b' : '#6c718c',
                fontSize: '11px',
                fontWeight: 'bold',
                textAlign: 'center',
                transition: 'all 0.3s ease'
              }}
            >
              {signalBannerText}
            </div>

            {isScanningPhase ? (
              <div className="scanner-loading-state" style={{ textAlign: 'center', padding: '40px 20px', color: '#6c718c' }}>
                <div className="spinner-animation" style={{ fontSize: '32px', marginBottom: '12px' }}>🛰️</div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Analyzing tick streams across Volatility indices...</p>
                <p style={{ fontSize: '11px', marginTop: '6px' }}>Evaluating momentum, spreads, and historical confidence layers.</p>
              </div>
            ) : (
              <>
                <p className="scanner-instruction">Balanced strategies ranked below. Load directly to workspace.</p>

                <div className="strategy-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>
                  {sortedStrategies.map((strat, idx) => {
                    const key = strat.id || `${strat.name}-${idx}`;
                    const isGlobalWinner = idx === 0;

                    return (
                      <div 
                        key={key} 
                        className={`strategy-card ${isGlobalWinner ? 'top-card' : ''}`}
                        style={{ 
                          background: isGlobalWinner ? 'rgba(46, 212, 121, 0.05)' : '#141824', 
                          border: isGlobalWinner ? '1px solid rgba(46, 212, 121, 0.3)' : '1px solid #1e2335',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {isGlobalWinner && (
                          <div className="global-winner-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', color: '#2ed479' }}>
                            <span>GLOBAL WINNER</span>
                            <span>CONFIDENCE {strat.confidence}%</span>
                          </div>
                        )}

                        <div className="card-main-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="badge-rank" style={{ background: '#1e2335', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', color: '#94a3b8' }}>#{idx + 1}</span>
                            <div className="strategy-info">
                              <strong style={{ color: '#fff', fontSize: '13px' }}>{strat.name}</strong>
                              <div className="card-tags-row" style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                <span className="market-tag" style={{ fontSize: '10px', background: '#1e2335', padding: '1px 6px', borderRadius: '4px', color: '#94a3b8' }}>{strat.market}</span>
                                {strat.direction && (
                                  <span className={`direction-tag ${strat.direction.toLowerCase()}`} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px' }}>
                                    {strat.direction}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={isGlobalWinner ? "badge-high" : "badge-medium"} style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', background: isGlobalWinner ? 'rgba(46, 212, 121, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: isGlobalWinner ? '#2ed479' : '#60a5fa' }}>
                            {isGlobalWinner ? "HIGH" : "MEDIUM"}
                          </span>
                        </div>

                        <div className="card-sub-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6c718c' }}>
                          <span>Score: {strat.score || strat.confidence}%</span>
                          <span>Confidence: {strat.confidence}%</span>
                        </div>

                        <button 
                          className="run-manual-btn" 
                          onClick={() => handleRunBot(strat)}
                          style={{ width: '100%', padding: '8px', background: '#2ed479', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', marginTop: '4px' }}
                        >
                          Load Strategy to Workspace
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
