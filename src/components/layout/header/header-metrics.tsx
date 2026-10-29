// ==========================================
// FILE: src/components/layout/header/header-metrics.tsx
// ==========================================
import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { observer as globalObserver } from '@/external/bot-skeleton/services/tradeEngine/utils/observer';
import './header-metrics.scss';

export const HeaderMetrics = observer(() => {
    const { client, run_panel, dbot } = useStore() ?? {};
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [livePnl, setLivePnl] = useState('+0.00 USD');

    const isRunning = client?.is_running || run_panel?.is_running || dbot?.is_running || false;

    // Monitor live data feed streaming status via api_base
    useEffect(() => {
        const interval = setInterval(() => {
            // Checks if live data ticks are actively flowing from the socket
            setIsLiveActive(api_base.isR10FeedLive());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Listen for real-time P&L updates from OpenContract execution engine
    useEffect(() => {
        const unregister = globalObserver.register('client.status.today_pnl', (newPnl: string) => {
            setLivePnl(newPnl);
        });

        return () => {
            if (typeof unregister === 'function') unregister();
        };
    }, []);

    // Fall back to client store status if available, otherwise use live observer state
    const displayPnl = client?.status?.today_pnl || livePnl;
    const isProfitable = !String(displayPnl).startsWith('-');

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
                    {displayPnl}
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
