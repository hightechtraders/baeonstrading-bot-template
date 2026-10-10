import React, { useEffect, useRef, useState } from 'react';
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
  const [statusText, setStatusText] = useState('Initializing neural network...');
  const [isFadingOut, setIsFadingOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Live Neural Network Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle nodes simulating neural signals
    const particleCount = Math.floor((width * height) / 15000);
    const particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        radius: Math.random() * 2 + 1.5,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw connecting lines (Neural Synapse effect)
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 130) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const alpha = (1 - distance / 130) * 0.25;
            ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw and move particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#00f2fe';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f2fe';
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Progress timer sequence
  useEffect(() => {
    const startTime = Date.now();
    const intervals = [
      { at: 20, text: 'Establishing secure WebSocket feed...' },
      { at: 45, text: 'Synchronizing neural workspaces & Blockly...' },
      { at: 75, text: 'Calibrating risk management models...' },
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
      {/* Live Animated Neural Canvas Background */}
      <div className="neural-bg-fx">
        <canvas ref={canvasRef} className="neural-canvas" />
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
