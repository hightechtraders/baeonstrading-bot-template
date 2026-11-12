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
    const [userName, setUserName] = useState<string>('');
    const [greeting, setGreeting] = useState('WELCOME, TRADER');
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [tempNameInput, setTempNameInput] = useState('');

    // Typing effect state with uppercase text and a 5-second hold before looping
    const fullSubtitleText = "AN INSTITUTIONAL-GRADE AUTOMATED TRADING PLATFORM. DEPLOY CUSTOM BLOCKLY STRATEGIES, RUN REAL-TIME MULTI-ASSET AI SCANNERS, AND MANAGE LIVE TICKS WITH SUB-MILLISECOND EXECUTION.";
    const [typedSubtitle, setTypedSubtitle] = useState('');

    // 1. Check localStorage on initial load; if missing, auto-open the name prompt modal
    useEffect(() => {
        const savedName = localStorage.getItem('trader_name');
        if (savedName) {
            setUserName(savedName);
        } else {
            // Auto-prompt first-time visitors immediately
            setIsPromptOpen(true);
        }
    }, []);

    // 2. Compute dynamic time-based greeting whenever userName changes
    useEffect(() => {
        const updateGreeting = () => {
            const hour = new Date().getHours();
            const displayName = userName ? userName.trim().toUpperCase() : 'TRADER';

            if (hour < 12) {
                setGreeting(`GOOD MORNING, ${displayName}`);
            } else if (hour < 17) {
                setGreeting(`GOOD AFTERNOON, ${displayName}`);
            } else {
                setGreeting(`GOOD EVENING, ${displayName}`);
            }
        };

        updateGreeting();
        const timer = setInterval(updateGreeting, 60000); // Check every minute
        return () => clearInterval(timer);
    }, [userName]);

    useEffect(() => {
        let currentIndex = 0;
        let isDeleting = false;
        const typingSpeed = 45; 
        const pauseBeforeRestart = 5000; 

        const interval = setInterval(() => {
            if (!isDeleting) {
                if (currentIndex <= fullSubtitleText.length) {
                    setTypedSubtitle(fullSubtitleText.slice(0, currentIndex));
                    currentIndex++;
                } else {
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

    // Save user-submitted name permanently and close modal
    const handleSaveName = (e: React.FormEvent) => {
        e.preventDefault();
        if (tempNameInput.trim()) {
            const cleanName = tempNameInput.trim();
            localStorage.setItem('trader_name', cleanName);
            setUserName(cleanName);
            setIsPromptOpen(false);
        }
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

            {/* Sticky Endless Market Ticker Bar with 15 Expanded Indices */}
            <div className="market-ticker-bar">
                <div className="ticker-track">
                    {/* Primary Ticker Set */}
                    <span className="ticker-item"><span className="symbol">R_100</span> <span className="up">+1.42%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 75 (1s)</span> <span className="up">+0.89%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 100 (1s)</span> <span className="up">+2.15%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 25</span> <span className="down">-0.65%</span></span>
                    <span className="ticker-item"><span className="symbol">Boom 1000</span> <span className="down">-0.34%</span></span>
                    <span className="ticker-item"><span className="symbol">Crash 500</span> <span className="up">+1.12%</span></span>
                    <span className="ticker-item"><span className="symbol">Jump 75 Index</span> <span className="up">+1.84%</span></span>
                    <span className="ticker-item"><span className="symbol">Bull Market Index</span> <span className="up">+2.45%</span></span>
                    <span className="ticker-item"><span className="symbol">Bear Market Index</span> <span className="down">-1.20%</span></span>
                    <span className="ticker-item"><span className="symbol">Range Break 200</span> <span className="up">+0.45%</span></span>
                    <span className="ticker-item"><span className="symbol">Step Index</span> <span className="up">+0.55%</span></span>
                    
                    {/* Exact Duplicate Set for Seamless -50% Infinite Loop */}
                    <span className="ticker-item"><span className="symbol">R_100</span> <span className="up">+1.42%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 75 (1s)</span> <span className="up">+0.89%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 100 (1s)</span> <span className="up">+2.15%</span></span>
                    <span className="ticker-item"><span className="symbol">Volatility 25</span> <span className="down">-0.65%</span></span>
                    <span className="ticker-item"><span className="symbol">Boom 1000</span> <span className="down">-0.34%</span></span>
                    <span className="ticker-item"><span className="symbol">Crash 500</span> <span className="up">+1.12%</span></span>
                    <span className="ticker-item"><span className="symbol">Jump 75 Index</span> <span className="up">+1.84%</span></span>
                    <span className="ticker-item"><span className="symbol">Bull Market Index</span> <span className="up">+2.45%</span></span>
                    <span className="ticker-item"><span className="symbol">Bear Market Index</span> <span className="down">-1.20%</span></span>
                    <span className="ticker-item"><span className="symbol">Range Break 200</span> <span className="up">+0.45%</span></span>
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
                {/* Optional click listener kept here just in case they want to update their name later */}
                <div 
                    className="hero-badge" 
                    onClick={() => setIsPromptOpen(true)} 
                    style={{ cursor: 'pointer' }}
                    title="Click to update name"
                >
                    <span>👋 {greeting} · DERIV API</span>
                </div>
                
                {/* Main Headline */}
                <h1 className="hero-title glowing-title">
                    Stop trading manually.<br />
                    <span className="highlight-text">Let TraderScore.pro do the heavy lifting.</span>
                </h1>

                {/* Stable Subtitle Wrapper with Typing Effect */}
                <div className="subtitle-container">
                    <span className="subtitle-placeholder">{fullSubtitleText}</span>
                    <p className="hero-subtitle hero-subtitle-larger subtitle-animated">
                        {typedSubtitle}
                        <span className="typing-cursor">_</span>
                    </p>
                </div>

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

            {/* Automated Welcome Modal Prompt for First-Time Visitors */}
            {isPromptOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(3, 7, 18, 0.9)', zIndex: 1000, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(5px)'
                }}>
                    <form onSubmit={handleSaveName} style={{
                        background: '#0f172a', border: '1px solid rgba(16, 185, 129, 0.4)',
                        padding: '28px', borderRadius: '12px', textAlign: 'center', maxWidth: '360px', width: '90%',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ color: '#f8fafc', marginBottom: '8px', fontSize: '1.2rem' }}>Welcome to TraderScore.pro</h3>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px', fontFamily: 'monospace' }}>
                            Please enter your name to personalize your professional trading workspace:
                        </p>
                        <input 
                            type="text" 
                            placeholder="e.g. Baron Ouma"
                            value={tempNameInput}
                            onChange={(e) => setTempNameInput(e.target.value)}
                            style={{
                                width: '100%', padding: '12px', background: '#030712', border: '1px solid #334155',
                                color: '#fff', borderRadius: '6px', marginBottom: '16px', boxSizing: 'border-box',
                                fontSize: '0.95rem'
                            }}
                            autoFocus
                            required
                        />
                        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '10px' }}>
                            Enter Workspace
                        </button>
                    </form>
                </div>
            )}

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
