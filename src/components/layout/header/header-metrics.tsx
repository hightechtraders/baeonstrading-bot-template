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
    
    // Check multiple possible locations for the running state across stores
    const isRunning = client?.is_running || run_panel?.is_running || dbot?.is_running || false;

    // Check if the current active chart/Blockly asset is R_10 for live streaming feeds
    // (Adjust `dash_store?.active_symbol` or similar property depending on your exact store structure)
    const activeSymbol = dash_store?.active_symbol || dbot?.active_symbol || 'R_10';
    const isR10Active = activeSymbol === 'R_10';

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
                <span className={`header-metrics__dot ${isR10Active ? 'header-metrics__dot--running' : 'header-metrics__dot--amber'}`} />
                <span className="header-metrics__label">
                    {isR10Active ? 'API Live (R_10)' : 'API Connected'}
                </span>
            </div>
        </div>
    );
});

export default HeaderMetrics;
