// ==========================================
// FILE: src/components/LandingPage.tsx
// ==========================================
import React from 'react';
import './LandingPage.scss'; // Style with your dark theme & SCSS

interface LandingPageProps {
    onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
    return (
        <div className="landing-container">
            <header className="landing-header">
                <div className="logo-area">
                    <span className="logo-badge">BAE</span>
                    <span className="brand-name">BAEONS TRADING</span>
                </div>
                <button className="btn-login-top" onClick={onLogin}>
                    Log in
                </button>
            </header>

            <main className="landing-hero">
                <div className="hero-badge">
                    <span>BULK TRADING · AUTOMATED AI · LIVE TRACKING</span>
                </div>
                
                <h1 className="hero-title">
                    Stop trading manually.<br />
                    <span className="highlight-text">Let your AI workspace do the heavy lifting.</span>
                </h1>

                <p className="hero-subtitle">
                    A high-performance trading automation workspace built on the Deriv API. Run custom indicators, deploy strategies, and track every market tick from one interface.
                </p>

                <div className="hero-actions">
                    <button className="btn-primary" onClick={onLogin}>
                        Log in to continue
                    </button>
                    <a 
                        href="https://track.deriv.com/_..." 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn-secondary"
                    >
                        Create a Deriv account
                    </a>
                </div>

                <div className="hero-footer-note">
                    <span>No subscription · Deriv account required · Start in under a minute</span>
                </div>
            </main>

            <section className="features-grid">
                <div className="feature-card">
                    <h3>High-speed execution</h3>
                    <p>Run automated indicator evaluations and entries through an optimized engine built on the Deriv API.</p>
                </div>
                <div className="feature-card">
                    <h3>AI Strategy Scanners</h3>
                    <p>Deploy real-time RSI, EMA, and Bollinger band analysis modules that track volatility indices seamlessly.</p>
                </div>
                <div className="feature-card">
                    <h3>Secure OAuth login</h3>
                    <p>Sign in securely through Deriv's official OAuth 2.0 flow — your credentials are never exposed or stored.</p>
                </div>
            </section>
        </div>
    );
};
