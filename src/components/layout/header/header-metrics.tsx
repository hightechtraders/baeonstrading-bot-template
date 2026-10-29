// ==========================================
// FILE: src/components/layout/header/header-metrics.tsx
// ==========================================
import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import './header-metrics.scss';

export const HeaderMetrics = observer(() => {
    const { client, run_panel, dbot } = useStore() ?? {};
    const [isR10Active, setIsR10Active] = useState(false);

    const todayPnl = client?.status?.today_pnl || '+0.00 USD';
    const isProfitable = !todayPnl.startsWith('-');
    const isRunning = client?.is_running || run_panel?.is_running || dbot?.is_running || false;

    // Check api_base live feed directly to see if R_10 ticks are streaming
    useEffect(() => {
        const interval = setInterval(() => {
            setIsR10Active(api_base.isR10FeedLive());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

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
