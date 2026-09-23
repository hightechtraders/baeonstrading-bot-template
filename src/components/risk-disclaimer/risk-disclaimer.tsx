import React from 'react';
import './RiskDisclaimer.css';

interface RiskDisclaimerProps {
  isOpen: boolean;
  onClose: () => void;
  onUnderstand?: () => void;
}

export const RiskDisclaimer: React.FC<RiskDisclaimerProps> = ({
  isOpen,
  onClose,
  onUnderstand,
}) => {
  if (!isOpen) return null;

  const handleUnderstand = () => {
    if (onUnderstand) onUnderstand();
    onClose();
  };

  return (
    <div className="risk-modal-overlay" onClick={onClose}>
      <div className="risk-modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="risk-modal-header">
          <div className="risk-modal-title">
            <span className="warning-icon">⚠️</span>
            <h3>Risk Disclaimer</h3>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="risk-modal-body">
          <div className="risk-banner">
            <span className="warning-icon-gold">⚠️</span>
            <strong>Trading involves significant risk.</strong>
          </div>

          <p className="risk-lead">
            You may lose all the money you invest. Never trade with money you cannot afford to lose.
          </p>

          <div className="risk-section-card">
            <h4>Losses</h4>
            <p>Only trade money you can afford to lose.</p>
          </div>

          <div className="risk-section-card">
            <h4>Leverage</h4>
            <p>Leverage can increase both gains and losses.</p>
          </div>

          <div className="risk-section-card">
            <h4>Responsibility</h4>
            <p>Make sure you understand the product and risks before trading.</p>
          </div>

          <p className="risk-footer-note">
            Past performance does not guarantee future results.
          </p>
        </div>

        {/* Footer */}
        <div className="risk-modal-footer">
          <a
            href="https://deriv.com/terms-and-conditions/#risk-disclaimer"
            target="_blank"
            rel="noopener noreferrer"
            className="read-more-link"
          >
            Read Full Risk Disclosure
          </a>
          <button type="button" className="btn-understand" onClick={handleUnderstand}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default RiskDisclaimer;
