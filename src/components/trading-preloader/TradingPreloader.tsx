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
  minLoadingTime = 8000
}) => {
  const [progress, setProgress] = useState(1);
  const [statusText, setStatusText] = useState('Initializing synaptic kernel...');
  const [terminalLogs, setTerminalLogs] = useState<string[]>(['[SYS] Handshaking Deriv neural synapse layer...']);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Genuinely Neural Network Brain Canvas Animation
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

    const nodes: Array<{ x: number; y: number; vx: number; vy: number; radius: number; color: string; connectionLimit: number }> = [];
    const particleCount = 200; // Increased for dense neural density
    const coreCount = 120; // High clustering for brain core
    const shellCount = 80; // Outward shell

    // Helper: Clustered Position Function (to form brain shape)
    const getClusteredPos = () => {
      // Clustering around central silhouette area (not random scatter)
      const isCore = Math.random() > 0.4;
      if (isCore) {
        // Brain Core (dense cluster)
        const centerX = width * 0.5 + (Math.random() - 0.5) * 120;
        const centerY = height * 0.45 + (Math.random() - 0.5) * 120;
        return { x: centerX, y: centerY, limit: 12, color: `hsla(${Math.random() * 30 + 190}, 100%, 80%, 0.9)` };
      } else {
        // Outward Synapse Shell
        const angle = Math.random() * Math.PI * 2;
        const dist = 180 + Math.random() * 100;
        const centerX = width * 0.5 + Math.cos(angle) * dist + (Math.random() - 0.5) * 80;
        const centerY = height * 0.45 + Math.sin(angle) * dist + (Math.random() - 0.5) * 80;
        return { x: centerX, y: centerY, limit: 6, color: `hsla(${Math.random() * 30 + 170}, 100%, 75%, 0.7)` };
      }
    };

    for (let i = 0; i < particleCount; i++) {
      const pos = getClusteredPos();
      nodes.push({
        x: pos.x,
        y: pos.y,
        vx: (Math.random() - 0.5) * 0.35, // Slow, intentional movement
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.5 + 0.8,
        color: pos.color,
        connectionLimit: pos.limit,
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // --- Draw Synaptic Pathways (Connected Arcs) ---
      for (let i = 0; i < nodes.length; i++) {
        let currentConnections = 0;
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Connection rules optimized for neural density
          const activeRange = distance < 180;
          const limitReached = currentConnections >= nodes[i].connectionLimit;

          if (activeRange && !limitReached) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            // Dynamic curvature for organic feel
            const cpX = (nodes[i].x + nodes[j].x) / 2 + (Math.random() - 0.5) * 15;
            const cpY = (nodes[i].y + nodes[j].y) / 2 + (Math.random() - 0.5) * 15;
            ctx.quadraticCurveTo(cpX, cpY, nodes[j].x, nodes[j].y);

            // Shimmering path color
            const alpha = (1 - distance / 180) * (Math.random() * 0.25 + 0.15);
            ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
            currentConnections++;
          }
        }
      }

      // --- Draw Pulsing Nodes ---
      nodes.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        // Soft internal bounce (avoid edge hit flicker)
        if (p.x < width * 0.05 || p.x > width * 0.95) p.vx *= -1;
        if (p.y < height * 0.05 || p.y > height * 0.9) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;

        // Add soft blur and nebula glow
        ctx.shadowBlur = Math.random() * 10 + 10;
        ctx.shadowColor = `rgba(0, 242, 254, ${Math.random() * 0.5 + 0.4})`;
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

  // Updated Diagnostic Terminal Sequence (for high-end AI feel)
  useEffect(() => {
    const startTime = Date.now();
    const milestones = [
      { at: 10, text: 'Synchronizing neural workspaces & Blockly nodes...', log: '[SYS] Handshaking Deriv neural synapse layer...' },
      { at: 30, text: 'Authenticating synaptic quantum key pairing...', log: '[NET] Websocket tunnel secured (Deriv V2.1)...' },
      { at: 55, text: 'Calibrating Volatility Index momentum buffers...', log: '[AI] Syncing predictive Blockly nodes...' },
      { at: 75, text: 'Validating real-time AI risk guardrails...', log: '[AI] Validating live tick feed (R_100)...' },
      { at: 92, text: 'Finalizing neural core interface...', log: '[SEC] Encryption layer active...' },
      { at: 100, text: 'Workspace ready. Launching synapse interface...', log: '[SYS] Terminal boot sequence complete.' }
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
            return [...prev.slice(-3), activeMilestone.log];
          }
          return prev;
        });
      }

      if (calculatedProgress >= 100) {
        clearInterval(timer);
        setIsFadingOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 1200);
      }
    }, 60);

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
          <div className="system-badge">SECURE NEURAL TERMINAL V2.4</div>
          <h1 className="brand-title">{appName}</h1>
          <p className="brand-subtitle">{subtitle}</p>
        </div>

        <div className="pulse-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>

        <div className="status-message">{statusText}</div>

        <div className="terminal-console" style={{ minHeight: '52px', overflow: 'hidden' }}>
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
            <span className="boot-label">Synaptic Initialization</span>
            <span className="progress-percentage">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
