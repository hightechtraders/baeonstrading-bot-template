// ==========================================
// FILE: src/components/layout/header/header-metrics.tsx
// ==========================================
import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import './header-metrics.scss';

export const HeaderMetrics = observer(() => {
    const { client, run_panel, dbot, dash_store } = useStore() ?? {};

    const todayPnl = client?.status?.today_pnl || '+0.00 USD';
    const isProfitable = !todayPnl.startsWith('-');
    
    const isRunning = client?.is_running || run_panel?.is_running || dbot?.is_running || false;

    // Grab the active symbol from whichever store property holds it
    const activeSymbol = 
        dash_store?.active_symbol || 
        dbot?.active_symbol || 
        dbot?.symbol || 
        dash_store?.symbol || 
        '';

    // Normalize string to check against short code or full Blockly display name
    const normalizedSymbol = String(activeSymbol).trim().toUpperCase();
    const isR10Active = 
        normalizedSymbol === 'R_10' || 
        normalizedSymbol === 'VOLATILITY 10 INDEX' ||
        normalizedSymbol.includes('VOLATILITY 10');

    return (
        <div className="header-metrics">
            <div className="header-metrics__item">
                <span className={`header-metrics__dot ${isRunning ? 'header-metrics__dot--running' : 'header-metrics__dot--idle'}`} />
                <span className="header-metrics__value header-metrics__value--prominent">
                    {isRunning ? 'Scanner Active' : 'Bot Idle'}
                </span>
            </div>

            <div className="header-metrics__item">
                <span className="header-metrics__label">P&L:</span>
                <span className={`header-metrics__value ${isProfitable ? 'header-metrics__value--success' : 'header-metrics__value--danger'}`}>
                    {todayPnl}
                </span>
            </div>

            <div className="header-metrics__item">
                <span className={`header-metrics__dot ${isR10Active ? 'header-metrics__dot--connected' : 'header-metrics__dot--amber'}`} />
                <span className="header-metrics__label">API Connected</span>
            </div>
        </div>
    );
});

export default HeaderMetrics;
