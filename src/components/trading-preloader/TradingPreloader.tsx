// ==========================================
// FILE: src/components/trading-preloader/TradingPreloader.tsx
// ==========================================
import React, { useEffect, useState } from 'react';
import './TradingPreloader.scss';

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
    subtitle = "TraderScore Trading Workspace",
    minLoadingTime = 1200,
    onLoadingComplete
}) => {
    const [progress, setProgress] = useState(0);
    const [stepIndex, setStepIndex] = useState(0);

    useEffect(() => {
        const startTime = Date.now();
        const intervalTime = 30; // Smooth increment tick
        
        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const calculatedProgress = Math.min(Math.floor((elapsed / minLoadingTime) * 100), 100);
            
            setProgress(calculatedProgress);

            // Dynamically update steps based on progress
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
                if (onLoadingComplete) {
                    onLoadingComplete();
                }
            }
        }, intervalTime);

        return () => clearInterval(timer);
    }, [minLoadingTime, onLoadingComplete]);

    return (
        <div className="trading-preloader-overlay">
            <div className="preloader-ambient-glow" />
            
            <div className="preloader-card">
                {/* Brand Logo / Icon Box */}
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
