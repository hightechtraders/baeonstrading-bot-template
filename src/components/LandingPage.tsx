// ==========================================
// FILE: src/components/LandingPage.tsx
// ==========================================
import React from 'react';
import './LandingPage.scss';

interface LandingPageProps {
    onLogin: () => void;
    onSignup: () => void; // Added signup handler prop
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin, onSignup }) => {
    return (
        <div className="landing-container">
            <div className="market-ticker-bar">
                <div className="ticker-track">
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
                        <span className="pulse-dot"></span> System Online
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
                
                <h1 className="hero-title">
                    Stop trading manually.<br />
                    <span className="highlight-text">Let TraderScore.pro do the heavy lifting.</span>
                </h1>

                <p className="hero-subtitle">
                    An institutional-grade automated trading platform. Deploy custom Blockly strategies, run real-time multi-asset AI scanners, and manage live ticks with sub-millisecond execution.
                </p>

                <div className="hero-actions">
                    <button className="btn-primary" onClick={onLogin}>
                        <span>Launch Workspace</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                    
                    {/* Wired to use the custom onSignup handler */}
                    <button 
                        onClick={onSignup}
                        className="btn-secondary"
                        style={{ background: 'transparent', cursor: 'pointer' }}
                    >
                        Create Deriv Account
                    </button>
                </div>

                <div className="hero-footer-note">
                    <span>⚡ Secure OAuth 2.0 Authorization · Zero Hidden Fees · Instant Setup</span>
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
                <p>&copy; {new Date().getFullYear()} TraderScore.pro. Built for professional traders on the Deriv API.</p>
            </footer>
        </div>
    );
};
