// ==========================================
// FILE: src/components/trading-preloader/TradingPreloader.tsx
// ==========================================
import React, { useEffect, useRef } from 'react';
import './TradingPreloader.css';

interface TradingPreloaderProps {
    appName?: string;
    subtitle?: string;
    minLoadingTime?: number;
    onLoadingComplete?: () => void;
}

const LOADING_STEPS = [
    "Establishing secure WebSocket connection...",
    "Calibrating synthetic volatility feed indices...",
    "Initializing TraderScore neural engine...",
    "Mounting workspace components..."
];

export const TradingPreloader: React.FC<TradingPreloaderProps> = ({
    appName = "TraderScore",
    subtitle = "TraderScore Neural Trading Workspace",
    minLoadingTime = 5000,
    onLoadingComplete
}) => {
    const rainCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const progressFillRef = useRef<HTMLDivElement | null>(null);
    const percentageTextRef = useRef<HTMLSpanElement | null>(null);
    const statusTextRef = useRef<HTMLSpanElement | null>(null);

    // 1. Butter-smooth background ticker canvas
    useEffect(() => {
        const canvas = rainCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let animationFrameId: number;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const handleResize = () => {
            if (!canvas) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const symbols = ['$', 'EUR', 'USD', 'BTC', 'GBP', 'JPY', '+1.25%', '-0.40%', '📈', '⚡', 'R_100', '1HZ75V', 'Volatility'];
        const drops: Array<{ x: number; y: number; speed: number; char: string; opacity: number }> = [];
        const dropCount = 140;

        for (let i = 0; i < dropCount; i++) {
            drops.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                speed: (Math.random() * 3.5 + 5.0) * 0.25,
                char: symbols[Math.floor(Math.random() * symbols.length)],
                opacity: Math.random() * 0.5 + 0.2
            });
        }

        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '12px "JetBrains Mono", monospace';

            for (let i = 0; i < drops.length; i++) {
                const drop = drops[i];
                drop.y += drop.speed;
                
                if (drop.y > canvas.height + 20) {
                    drop.y = -20;
                    drop.x = Math.random() * canvas.width;
                    drop.char = symbols[Math.floor(Math.random() * symbols.length)];
                }

                ctx.fillStyle = drop.char.includes('$') || drop.char.includes('+') 
                    ? `rgba(0, 255, 153, ${drop.opacity})` 
                    : `rgba(0, 242, 254, ${drop.opacity})`;
                
                ctx.fillText(drop.char, drop.x, drop.y);
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    // 2. High-performance counter animation loop using direct DOM refs (0% to 100% steady count)
    useEffect(() => {
        const startTime = Date.now();
        let animationFrameId: number;

        const updateCounter = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(Math.floor((elapsed / minLoadingTime) * 100), 100);

            // Directly update DOM elements without React re-renders
            if (progressFillRef.current) {
                progressFillRef.current.style.width = `${progress}%`;
            }
            if (percentageTextRef.current) {
                percentageTextRef.current.textContent = `${progress}%`;
            }
            if (statusTextRef.current) {
                if (progress < 30) statusTextRef.current.textContent = LOADING_STEPS[0];
                else if (progress < 60) statusTextRef.current.textContent = LOADING_STEPS[1];
                else if (progress < 85) statusTextRef.current.textContent = LOADING_STEPS[2];
                else statusTextRef.current.textContent = LOADING_STEPS[3];
            }

            if (progress < 100) {
                animationFrameId = requestAnimationFrame(updateCounter);
            } else {
                // Finished loading, trigger fade out
                setTimeout(() => {
                    if (overlayRef.current) {
                        overlayRef.current.classList.add('fade-out');
                    }
                    setTimeout(() => {
                        if (onLoadingComplete) {
                            onLoadingComplete();
                        }
                    }, 600);
                }, 200);
            }
        };

        animationFrameId = requestAnimationFrame(updateCounter);

        return () => cancelAnimationFrame(animationFrameId);
    }, [minLoadingTime, onLoadingComplete]);

    return (
        <div ref={overlayRef} className="trading-preloader-overlay">
            {/* Background Effects */}
            <div className="preloader-grid-bg" />
            <canvas ref={rainCanvasRef} className="market-rain-canvas" />
            <div className="preloader-glow-orb orb-1" />
            <div className="preloader-glow-orb orb-2" />
            
            <div className="preloader-card">
                {/* Brand Emblem */}
                <div className="brand-emblem">
                    <div className="pulse-ring" />
                    <div className="inner-core">
                        <svg className="terminal-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                </div>

                {/* Titles */}
                <div className="preloader-titles">
                    <h1>{appName}</h1>
                    <p>{subtitle}</p>
                </div>

                {/* Progress Bar Container */}
                <div className="progress-container">
                    <div className="progress-track">
                        <div ref={progressFillRef} className="progress-fill" style={{ width: '0%' }} />
                    </div>
                    <div className="progress-meta">
                        <span ref={statusTextRef} className="status-text">{LOADING_STEPS[0]}</span>
                        <span ref={percentageTextRef} className="percentage-text">0%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
