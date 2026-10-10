import React, { useEffect, useState } from 'react';
import './TradingPreloader.css';

interface TradingPreloaderProps {
  appName?: string;
  subtitle?: string;
  onComplete?: () => void;
  minLoadingTime?: number;
}

export const TradingPreloader: React.FC<TradingPreloaderProps> = ({
  appName = 'TraderScore',
  subtitle = 'TraderScore Trading Workspace',
  onComplete,
  minLoadingTime = 2500
}) => {
  const [progress, setProgress] = useState(1);
  const [statusText, setStatusText] = useState('Connecting to secure feeds...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const intervals = [
      { at: 20, text: 'Connecting to secure feeds...' },
      { at: 45, text: 'Synchronizing neural workspaces...' },
      { at: 75, text: 'Calibrating risk management modules...' },
      { at: 95, text: 'Boot sequence finalized...' },
    ];

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min(
        Math.floor((elapsed / minLoadingTime) * 100),
        100
      );

      setProgress(calculatedProgress);

      const currentMilestone = [...intervals].reverse().find(m => calculatedProgress >= m.at);
      if (currentMilestone) {
        setStatusText(currentMilestone.text);
      }

      if (calculatedProgress >= 100) {
        clearInterval(timer);
        setIsFadingOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 600);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [minLoadingTime, onComplete]);

  return (
    <div className={`trading-preloader-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      {/* Background Neon Orbs & Chart Grid FX */}
      <div className="neural-bg-fx">
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
      </div>

      {/* Glassmorphic Central Card */}
      <div className="preloader-card">
        <div className="brand-header">
          <h1 className="brand-title">{appName}</h1>
          <p className="brand-subtitle">{subtitle}</p>
        </div>

        <div className="pulse-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>

        <div className="status-message">{statusText}</div>

        <div className="progress-container">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }}>
              <div className="progress-glow-head"></div>
            </div>
          </div>
          <div className="progress-footer">
            <span className="boot-label">Boot sequence</span>
            <span className="progress-percentage">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
