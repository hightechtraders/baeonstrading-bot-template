// ==========================================
// FILE: src/components/layout/header/header-metrics.tsx
// ==========================================
import React from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import './header-metrics.scss';

export const HeaderMetrics = observer(() => {
    const { client } = useStore() ?? {};

    const todayPnl = client?.status?.today_pnl || '+0.00 USD';
    const isProfitable = !todayPnl.startsWith('-');
    const isRunning = client?.is_running || false;

    return (
        <div className="header-metrics">
            {/* Bot Status & Dynamic Running/Idle Indicator */}
            <div className="header-metrics__item">
                <span className={`header-metrics__dot ${isRunning ? 'header-metrics__dot--running' : 'header-metrics__dot--idle'}`} />
                <span className="header-metrics__value header-metrics__value--prominent">
                    {isRunning ? 'Scanner Active' : 'Bot Idle'}
                </span>
            </div>

            {/* P&L Counter */}
            <div className="header-metrics__item">
                <span className="header-metrics__label">P&L:</span>
                <span className={`header-metrics__value ${isProfitable ? 'header-metrics__value--success' : 'header-metrics__value--danger'}`}>
                    {todayPnl}
                </span>
            </div>

            {/* API Connected Indicator */}
            <div className="header-metrics__item">
                <span className="header-metrics__dot header-metrics__dot--connected" />
                <span className="header-metrics__label">API Connected</span>
            </div>
        </div>
    );
});

export default HeaderMetrics;
