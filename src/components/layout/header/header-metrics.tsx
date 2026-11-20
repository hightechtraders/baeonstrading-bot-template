// ==========================================
// FILE: src/components/layout/header/header-metrics.tsx
// ==========================================
import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import './header-metrics.scss';

export const HeaderMetrics = observer(() => {
    const { client, run_panel, dbot } = useStore() ?? {};
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [livePnl, setLivePnl] = useState('+0.00 USD');
    const lastMultiTickRef = useRef<number>(0);

    const isRunning = client?.is_running || run_panel?.is_running || dbot?.is_running || false;

    // Monitor multi-volatility tick flow + WebSocket connection state (no R_10 dependency)
    useEffect(() => {
        const handleMultiTick = () => {
            lastMultiTickRef.current = Date.now();
            setIsLiveActive(true);
        };

        window.addEventListener('ai-tick-received', handleMultiTick);
        window.addEventListener('deriv_scanner_updated', handleMultiTick);

        const interval = setInterval(() => {
            const socketOpen = api_base?.api?.connection?.readyState === WebSocket.OPEN;
            const isStreamFlowing = Date.now() - lastMultiTickRef.current < 6000;

            setIsLiveActive(Boolean(socketOpen && isStreamFlowing));
        }, 1000);

        return () => {
            clearInterval(interval);
            window.removeEventListener('ai-tick-received', handleMultiTick);
            window.removeEventListener('deriv_scanner_updated', handleMultiTick);
        };
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

        // Sync immediately on mount in case api_base already restored session trades
        const initialPnl = Number(api_base?.session_pnl || 0);
        const initialCurrency = api_base?.session_currency || 'USD';
        setLivePnl(`${initialPnl >= 0 ? '+' : ''}${initialPnl.toFixed(2)} ${initialCurrency}`);

        return () => {
            window.removeEventListener('deriv_pnl_update', handlePnlUpdate);
        };
    }, []);

    // Fall back to client store status if available, otherwise use live websocket P&L
    const todayPnl = client?.status?.today_pnl || client?.today_pnl || livePnl;
    const isProfitable = !String(todayPnl).startsWith('-');
    const hasNonZeroPnl = !String(todayPnl).startsWith('+0.00') && !String(todayPnl).startsWith('0.00');

    const handleResetPnl = () => {
        const currency = client?.currency || api_base.session_currency || 'USD';
        api_base.resetSessionPnl(currency);
    };

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
                {hasNonZeroPnl && (
                    <button
                        type="button"
                        onClick={handleResetPnl}
                        title="Reset Session P&L"
                        className="header-metrics__reset-btn"
                    >
                        ↺
                    </button>
                )}
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
