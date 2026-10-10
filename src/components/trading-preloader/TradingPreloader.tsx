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
  subtitle = 'TraderScore Neural Trading Workspace',
  onComplete,
  minLoadingTime = 4800 // Extended for a deliberate, professional boot feel
}) => {
  const [progress, setProgress] = useState(1);
  const [statusText, setStatusText] = useState('Initializing secure kernel...');
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['[SYS] Boot sequence initiated...']);
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

    const particleCount = Math.floor((width * height) / 12000);
    const particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const alpha = (1 - distance / 150) * 0.3;
            ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#00f2fe';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#00f2fe';
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Detailed Terminal Log Sequence
  useEffect(() => {
    const startTime = Date.now();
    const milestones = [
      { at: 10, text: 'Establishing secure WebSocket feed to Deriv...', log: '[NET] Handshaking wss://ws.derivws.com...' },
      { at: 30, text: 'Authenticating OAuth tokens & session scopes...', log: '[AUTH] Validating client access credentials...' },
      { at: 55, text: 'Synchronizing neural workspaces & Blockly nodes...', log: '[CORE] Mounting MobX state management stores...' },
      { at: 75, text: 'Calibrating Volatility Index momentum buffers...', log: '[AI] Calibrating live tick feed buffers (1HZ50V, R_100)...' },
      { at: 92, text: 'Finalizing risk management guardrails...', log: '[SEC] Risk disclaimer verification successful.' },
      { at: 100, text: 'Workspace ready. Launching interface...', log: '[SYS] Terminal boot sequence complete.' }
    ];

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const calculatedProgress = Math.min(
        Math.floor((elapsed / minLoadingTime) * 100),
        100
      );

      setProgress(calculatedProgress);

      const activeMilestone = [...milestones].reverse().find(m => calculatedProgress >= m.at);
      if (activeMilestone) {
        setStatusText(activeMilestone.text);
        setTerminalLogs(prev => {
          if (!prev.includes(activeMilestone.log)) {
            return [...prev.slice(-3), activeMilestone.log]; // Keep last 3 logs for clean UI
          }
          return prev;
        });
      }

      if (calculatedProgress >= 100) {
        clearInterval(timer);
        setIsFadingOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 700);
      }
    }, 40);

    return () => clearInterval(timer);
  }, [minLoadingTime, onComplete]);

  return (
    <div className={`trading-preloader-overlay ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="neural-bg-fx">
        <canvas ref={canvasRef} className="neural-canvas" />
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
      </div>

      <div className="preloader-card">
        <div className="brand-header">
          <div className="system-badge">SECURE TERMINAL V2.4</div>
          <h1 className="brand-title">{appName}</h1>
          <p className="brand-subtitle">{subtitle}</p>
        </div>

        <div className="pulse-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>

        <div className="status-message">{statusText}</div>

        {/* Technical Live Console Log Box */}
        <div className="terminal-console">
          {terminalLogs.map((log, index) => (
            <div key={index} className="terminal-line">{log}</div>
          ))}
        </div>

        <div className="progress-container">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }}>
              <div className="progress-glow-head"></div>
            </div>
          </div>
          <div className="progress-footer">
            <span className="boot-label">System Diagnostics</span>
            <span className="progress-percentage">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
