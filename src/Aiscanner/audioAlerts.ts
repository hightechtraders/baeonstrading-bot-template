// src/Aiscanner/audioAlerts.ts

export class AudioAlerts {
  public static playChime(style: 'SUCCESS_RISE' | 'ALERT_ECHO' | 'STRONG_SIGNAL_LOCK'): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      const now = ctx.currentTime;

      if (style === 'SUCCESS_RISE') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); 
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); 
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.55);
        osc.start(now); osc.stop(now + 0.55);
      } else if (style === 'STRONG_SIGNAL_LOCK') {
        // Distinct upbeat chime for 3-tick high-confidence signal lock
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);       // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1);  // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2);  // G5
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.45);
        osc.start(now); osc.stop(now + 0.45);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220.00, now); 
        gainNode.gain.setValueAtTime(0.35, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.45);
        osc.start(now); osc.stop(now + 0.45);
      }
    } catch (e) {}
  }

  public static showModal(type: 'PROFIT' | 'LOSS', balance: number, limit: number, activeRunsCount: number | string): void {
    const existingModal = document.getElementById('treda-circuit-breaker-modal');
    if (existingModal) existingModal.remove();

    const isProfit = type === 'PROFIT';
    const primaryColor = isProfit ? '#2ed479' : '#ff4a62';
    const glowColor = isProfit ? 'rgba(46, 212, 121, 0.2)' : 'rgba(255, 74, 98, 0.2)';
    
    this.playChime(isProfit ? 'SUCCESS_RISE' : 'ALERT_ECHO');

    const backdrop = document.createElement('div');
    backdrop.id = 'treda-circuit-breaker-modal';
    Object.assign(backdrop.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(6px)',
      zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', boxSizing: 'border-box', opacity: '0', transition: 'opacity 0.25s ease'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#0e111a', border: `1px solid ${primaryColor}`, borderRadius: '14px',
      width: '100%', maxWidth: '340px', padding: '24px 20px', boxSizing: 'border-box',
      textAlign: 'center', boxShadow: `0 10px 40px ${glowColor}`, transform: 'scale(0.9)',
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: '-apple-system, sans-serif'
    });

    card.innerHTML = `
      <div style="color: #6c718c; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
        🌐 tredascore.pro says:
      </div>
      <div style="font-size: 32px; margin-bottom: 12px;">${isProfit ? '🏆' : '🛑'}</div>
      <h2 style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase;">
        ${isProfit ? 'Target Profit Breach' : 'Drawdown Breached'}
      </h2>
      <p style="color: #6c718c; font-size: 11px; margin: 0 0 20px 0;">Automated circuit breaker deployed.</p>
      <div style="background: #141824; border: 1px solid #1e2335; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Session Balance:</span>
          <span style="font-weight: bold; color: ${primaryColor};">${isProfit ? '+' : '-'}$${Math.abs(balance).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Trigger Target:</span>
          <span style="font-weight: bold; color: #ffffff;">$${limit.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Total Cycle Runs:</span>
          <span style="font-weight: bold; color: #f5a623;">${activeRunsCount} Cycles</span>
        </div>
      </div>
      <button id="close-breaker-modal-btn" style="width: 100%; background: #1c2035; border: 1px solid #2d3450; color: #ffffff; padding: 12px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer;">
        ACKNOWLEDGE & DISMISS
      </button>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    setTimeout(() => { backdrop.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 10);

    const dismissModal = () => {
      backdrop.style.opacity = '0'; card.style.transform = 'scale(0.9)';
      setTimeout(() => {
        backdrop.remove();
        const el = document.querySelector('#id-dashboard') || document.querySelector('.dbot-tab__dashboard');
        if (el) (el as HTMLElement).click();
      }, 250);
    };

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) dismissModal(); });
    card.querySelector('#close-breaker-modal-btn')?.addEventListener('click', dismissModal);
  }
}
