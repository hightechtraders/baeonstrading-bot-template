// ==========================================
// FILE: src/components/trading-preloader/TradingPreloader.tsx
// ==========================================
import React, { useEffect, useRef, useState } from 'react';
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
    minLoadingTime = 2500,
    onLoadingComplete
}) => {
    const [progress, setProgress] = useState(0);
    const [stepIndex, setStepIndex] = useState(0);
    const [isFadingOut, setIsFadingOut] = useState(false);
    
    const rainCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Completely decoupled, high-performance canvas loop that never pauses for React state updates
    useEffect(() => {
        const canvas = rainCanvasRef.current;
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

        const symbols = ['$', 'EUR', 'USD', 'BTC', 'GBP', 'JPY', '+1.25%', '-0.40%', '📈', '⚡', 'R_100', '1HZ75V', 'Volatility'];
        const drops: Array<{ x: number; y: number; speed: number; char: string; opacity: number; size: number }> = [];
        const dropCount = 130;

        for (let i = 0; i < dropCount; i++) {
            drops.push({
                x: Math.random() * width,
                y: Math.random() * height - height,
                speed: Math.random() * 4.0 + 6.0, // High-speed continuous cascade
                char: symbols[Math.floor(Math.random() * symbols.length)],
                opacity: Math.random() * 0.5 + 0.2,
                size: 12
            });
        }

        const render = () => {
            ctx.clearRect(0, 0, width, height);
            ctx.font = '12px "JetBrains Mono", monospace';

            for (let i = 0; i < drops.length; i++) {
                const drop = drops[i];
                drop.y += drop.speed;
                
                if (drop.y > height + 20) {
                    drop.y = -20;
                    drop.x = Math.random() * width;
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

    // Separate isolated progress counter loop
    useEffect(() => {
        const startTime = Date.now();
        const intervalTime = 30; 
        
        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const calculatedProgress = Math.min(Math.floor((elapsed / minLoadingTime) * 100), 100);
            
            setProgress(calculatedProgress);

            if (calculatedProgress < 30) {
                setStepIndex(0);
            } else if (calculatedProgress < 60) {
                setStepIndex(1);
            } else if (calculatedProgress < 85) {
                setStepIndex(2);
            } else {
                setStepIndex(3);
            }

            if (elapsed >= minLoadingTime) {
                clearInterval(timer);
                setIsFadingOut(true);
                setTimeout(() => {
                    if (onLoadingComplete) {
                        onLoadingComplete();
                    }
                }, 600);
            }
        }, intervalTime);

        return () => clearInterval(timer);
    }, [minLoadingTime, onLoadingComplete]);

    return (
        <div className={`trading-preloader-overlay ${isFadingOut ? 'fade-out' : ''}`}>
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
                        <div 
                            className="progress-fill" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <div className="progress-meta">
                        <span className="status-text">{LOADING_STEPS[stepIndex]}</span>
                        <span className="percentage-text">{progress}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
