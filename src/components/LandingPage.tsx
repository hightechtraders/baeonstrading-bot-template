// ==========================================
// FILE: src/components/LandingPage.tsx
// ==========================================
import React, { useState, useEffect } from 'react';
import { LiveChartBackground } from './LiveChartBackground';
import './LandingPage.scss';

interface LandingPageProps {
    onLogin: () => void;
    onSignup: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onSignup }) => {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    // Typing effect state with a 5-second hold before looping
    const fullSubtitleText = "An institutional-grade automated trading platform. Deploy custom Blockly strategies, run real-time multi-asset AI scanners, and manage live ticks with sub-millisecond execution.";
    const [typedSubtitle, setTypedSubtitle] = useState('');

    useEffect(() => {
        let currentIndex = 0;
        let isDeleting = false;
        const typingSpeed = 45; // Smooth, relaxed speed
        const pauseBeforeRestart = 5000; // Exactly 5 seconds hold time

        const interval = setInterval(() => {
            if (!isDeleting) {
                if (currentIndex <= fullSubtitleText.length) {
                    setTypedSubtitle(fullSubtitleText.slice(0, currentIndex));
                    currentIndex++;
                } else {
                    // Reached the end, hold for 5 seconds before clearing and restarting
                    isDeleting = true;
                    setTimeout(() => {
                        isDeleting = false;
                        currentIndex = 0;
                    }, pauseBeforeRestart);
                }
            }
        }, typingSpeed);

        return () => clearInterval(interval);
    }, []);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    return (
        <div className="landing-container" onMouseMove={handleMouseMove}>
            {/* 🌟 Live Simulated Background Chart */}
            <LiveChartBackground />

            {/* Ambient Mouse-Follow Glow Effect */}
            <div 
                className="mouse-glow" 
                style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
            ></div>

            {/* Sticky Endless Market Ticker Bar */}
            <div className="market-ticker-bar">
                <div className="ticker-track">
                    {/* Primary Ticker Set */}
                    <span className="ticker-item"><span className="symbol">R_100</span> <span className="up">+1.42%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 75 (1s)</span> <span className="up">+0.89%</span></span>
                    <span className="ticker-item"><span className="symbol">Boom 1000</span> <span className="down">-0.34%</span></span>
                    <span className="ticker-item"><span className="symbol">Crash 500</span> <span className="up">+1.12%</span></span>
                    <span className="ticker-item"><span className="symbol">Step Index</span> <span className="up">+0.55%</span></span>
                    
                    {/* Exact Duplicate Set for Seamless -50% Infinite Loop */}
                    <span className="ticker-item"><span className="symbol">R_100</span> <span className="up">+1.42%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 75 (1s)</span> <span className="up">+0.89%</span></span>
                    <span className="ticker-item"><span className="symbol">Boom 1000</span> <span className="down">-0.34%</span></span>
                    <span className="ticker-item"><span className="symbol">Crash 500</span> <span className="up">+1.12%</span></span>
                    <span className="ticker-item"><span className="symbol">Step Index</span> <span className="up">+0.55%</span></span>
                </div>
            </div>

            <header className="landing-header">
                <div className="logo-area">
                    <span className="logo-badge">TS</span>
                    <span className="brand-name">TraderScore.pro</span>
                </div>
                <div className="header-actions">
                    <span className="status-indicator">
                        <span className="pulse-dot"></span> 
                        <span>API: 12ms | Uptime: 99.99%</span>
                    </span>
                    <button className="btn-login-top" onClick={onLogin}>
                        Log in
                    </button>
                </div>
            </header>

            <main className="landing-hero">
                <div className="hero-badge">
                    <span>NEXT-GEN AI TRADING WORKSPACE · DERIV API</span>
                </div>
                
                {/* Main Headline with direct text opacity fade-in/out pulsing */}
                <h1 className="hero-title glowing-title">
                    Stop trading manually.<br />
                    <span className="highlight-text">Let TraderScore.pro do the heavy lifting.</span>
                </h1>

                {/* Subtitle with typing effect, 5s hold, and increased font size */}
                <p className="hero-subtitle hero-subtitle-larger">
                    {typedSubtitle}
                    <span className="typing-cursor">_</span>
                </p>

                <div className="hero-actions">
                    <button className="btn-primary" onClick={onLogin}>
                        <span>Launch Workspace</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                    
                    <button onClick={onSignup} className="btn-secondary">
                        Create Deriv Account
                    </button>
                </div>

                {/* Glassmorphism Tech-Trust Strip */}
                <div className="tech-trust-strip">
                    <span>🔒 OAuth 2.0 Secure</span>
                    <span>⚡ WebSocket v2</span>
                    <span>🛡️ Zero Hidden Fees</span>
                </div>

                <div className="hero-footer-note">
                    <span>⚡ Secure OAuth 2.0 Authorization · Instant Setup</span>
                </div>
            </main>

            <section className="features-grid">
                <div className="feature-card">
                    <div className="card-icon">⚡</div>
                    <h3>Blazing-Fast Execution</h3>
                    <p>Optimized WebSocket tick listeners process market data instantly to reduce latency on automated entry triggers.</p>
                </div>
                <div className="feature-card">
                    <div className="card-icon">🤖</div>
                    <h3>AI Multi-Asset Scanners</h3>
                    <p>Continuous background market monitoring evaluates volatility indices, RSI, and custom indicators automatically.</p>
                </div>
                <div className="feature-card">
                    <div className="card-icon">🧩</div>
                    <h3>Blockly Strategy Bridge</h3>
                    <p>Seamlessly load and execute customized visual strategy files with direct parameter injection capabilities.</p>
                </div>
                <div className="feature-card">
                    <div className="card-icon">🛡️</div>
                    <h3>Advanced Risk Controls</h3>
                    <p>Protect your capital with automated take-profit, stop-loss, and multi-tier account switching safeguards.</p>
                </div>
            </section>

            <footer className="landing-footer">
                <p>&copy; {new Date().getFullYear()} TraderScore.pro · Built by Baron Ouma for professional traders on the Deriv API.</p>
            </footer>
        </div>
    );
};
