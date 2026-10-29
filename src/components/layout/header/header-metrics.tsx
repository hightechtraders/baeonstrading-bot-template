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
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [livePnl, setLivePnl] = useState('+0.00 USD');

    const isRunning = client?.is_running || run_panel?.is_running || dbot?.is_running || false;

    // Monitor live data feed streaming status via api_base
    useEffect(() => {
        const interval = setInterval(() => {
            setIsLiveActive(api_base.isR10FeedLive());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Listen to real-time P&L updates (wins & losses) streamed directly from api_base websocket
    useEffect(() => {
        const handlePnlUpdate = (event: Event) => {
            const customEvent = event as CustomEvent;
            if (customEvent.detail?.pnl) {
                setLivePnl(customEvent.detail.pnl);
            }
        };

        window.addEventListener('deriv_pnl_update', handlePnlUpdate);
        return () => {
            window.removeEventListener('deriv_pnl_update', handlePnlUpdate);
        };
    }, []);

    // Fall back to client store status if available, otherwise use live websocket P&L
    const todayPnl = client?.status?.today_pnl || client?.today_pnl || livePnl;
    const isProfitable = !String(todayPnl).startsWith('-');

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
                <span className={`header-metrics__dot ${isLiveActive ? 'header-metrics__dot--connected' : 'header-metrics__dot--amber'}`} />
                <span className="header-metrics__label">
                    {isLiveActive ? 'API Connected' : 'Standby'}
                </span>
            </div>
        </div>
    );
});

export default HeaderMetrics;
