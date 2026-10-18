// ==========================================
// FILE: src/Aiscanner/FloatingAI.tsx
// ==========================================
import React, { useState, useEffect, useRef } from 'react';
import { ScannerBridge } from './scannerBridge';
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { useScannerFeed } from './useScannerFeed'; 
import './FloatingAI.css';

interface StrategyParams {
  stake: number;
  stopLoss: number;
  takeProfit: number;
}

export const FloatingAI: React.FC = () => {
  useScannerFeed();

  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);
  
  const [signalBannerText, setSignalBannerText] = useState<string>("🔍 Listening for Live Deriv Ticks...");
  const [isSignalLocked, setIsSignalLocked] = useState<boolean>(false);
  const [isSweetSpot, setIsSweetSpot] = useState<boolean>(false);
  const [isScanningPhase, setIsScanningPhase] = useState<boolean>(true);

  // Store parameters per strategy key (id or index) so they don't share a single global input state
  const [strategyParams, setStrategyParams] = useState<Record<string, StrategyParams>>({});

  const isOpenRef = useRef<boolean>(false);
  const isScanningPhaseRef = useRef<boolean>(true);
  const sweetSpotStreakRef = useRef<number>(0);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    isScanningPhaseRef.current = isScanningPhase;
  }, [isScanningPhase]);

  // Initialize or update local parameter states when strategies change
  useEffect(() => {
    const initialParams: Record<string, StrategyParams> = {};
    strategies.forEach((strat, idx) => {
      const key = strat.id || `${strat.name}-${idx}`;
      initialParams[key] = {
        stake: strat.recommendedStake || 10,
        stopLoss: strat.recommendedStopLoss || 20,
        takeProfit: strat.recommendedTakeProfit || 50,
      };
    });
    setStrategyParams(initialParams);
  }, [strategies]);

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

  const handleParamChange = (key: string, field: keyof StrategyParams, value: number) => {
    setStrategyParams(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { stake: 10, stopLoss: 20, takeProfit: 50 }),
        [field]: value
      }
    }));
  };

  const handleRunBot = (strat: Strategy, key: string) => {
    const params = strategyParams[key] || { stake: 10, stopLoss: 20, takeProfit: 50 };
    ScannerBridge.loadStrategyToWorkspace(strat, { 
      stake: params.stake, 
      stopLoss: params.stopLoss, 
      takeProfit: params.takeProfit 
    });
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
                <p className="scanner-instruction">Balanced strategies ranked below. Adjust parameters and load directly.</p>

                <div className="strategy-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto', paddingRight: '4px' }}>
                  {sortedStrategies.map((strat, idx) => {
                    const key = strat.id || `${strat.name}-${idx}`;
                    const currentParams = strategyParams[key] || { stake: 10, stopLoss: 20, takeProfit: 50 };
                    const isGlobalWinner = idx === 0;

                    return (
                      <div 
                        key={key} 
                        className={`strategy-card ${isGlobalWinner ? 'top-card' : ''}`}
                        style={{ background: isGlobalWinner ? 'rgba(46, 212, 121, 0.05)' : undefined, border: isGlobalWinner ? '1px solid rgba(46, 212, 121, 0.3)' : undefined }}
                      >
                        {isGlobalWinner && (
                          <div className="global-winner-meta" style={{ marginBottom: '8px' }}>
                            <span>GLOBAL WINNER</span>
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
                          <span className={isGlobalWinner ? "badge-high" : "badge-medium"}>
                            {isGlobalWinner ? "HIGH" : "MEDIUM"}
                          </span>
                        </div>

                        <div className="card-sub-row" style={{ marginBottom: '10px' }}>
                          <span>Score {strat.score || strat.confidence}%</span>
                          <span>Confidence {strat.confidence}%</span>
                        </div>

                        {/* Always visible inline parameter inputs and load button */}
                        <div className="parameter-drawer" style={{ display: 'block', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                              <label style={{ fontSize: '10px', marginBottom: '4px', color: '#94a3b8' }}>Stake ($):</label>
                              <input 
                                type="number" 
                                value={currentParams.stake} 
                                onChange={(e) => handleParamChange(key, 'stake', Number(e.target.value))}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '12px' }}
                              />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                              <label style={{ fontSize: '10px', marginBottom: '4px', color: '#94a3b8' }}>Stop Loss ($):</label>
                              <input 
                                type="number" 
                                value={currentParams.stopLoss} 
                                onChange={(e) => handleParamChange(key, 'stopLoss', Number(e.target.value))}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '12px' }}
                              />
                            </div>
                            <div className="input-group" style={{ display: 'flex', flexDirection: 'column' }}>
                              <label style={{ fontSize: '10px', marginBottom: '4px', color: '#94a3b8' }}>Take Profit ($):</label>
                              <input 
                                type="number" 
                                value={currentParams.takeProfit} 
                                onChange={(e) => handleParamChange(key, 'takeProfit', Number(e.target.value))}
                                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #334155', background: '#0f172a', color: '#fff', fontSize: '12px' }}
                              />
                            </div>
                          </div>
                          <button 
                            className="run-manual-btn" 
                            onClick={() => handleRunBot(strat, key)}
                            style={{ width: '100%', padding: '8px', background: '#2ed479', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Load Strategy to Workspace
                          </button>
                        </div>
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
