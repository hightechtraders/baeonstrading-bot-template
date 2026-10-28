import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';

export const HeaderMetrics = observer(() => {
    const { client, ws } = useStore() ?? {};
    const [ping, setPing] = useState<number | null>(45); // Simulated or fetched WebSocket latency

    // Simulated PnL tracker pulling from active trading store state
    const todayPnl = client?.status?.today_pnl || '+0.00 USD';
    const isProfitable = !todayPnl.startsWith('-');
    const isRunning = client?.is_running || false;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', margin: '0 auto' }}>
            {/* 1. Bot Status Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--general-main-1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--general-section-1)' }}>
                <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isRunning ? 'var(--status-success)' : 'var(--text-less-prominent)',
                    boxShadow: isRunning ? '0 0 8px var(--status-success)' : 'none'
                }} />
                <span style={{ fontSize: '11px', color: 'var(--text-prominent)', fontWeight: 600 }}>
                    {isRunning ? 'Scanner Active' : 'Bot Idle'}
                </span>
            </div>

            {/* 2. Live P&L Ticker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--general-main-1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--general-section-1)' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-less-prominent)' }}>P&L:</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: isProfitable ? 'var(--status-success)' : 'var(--status-danger)' }}>
                    {todayPnl}
                </span>
            </div>

            {/* 3. API Connection Health Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--general-main-1)', padding: '6px 12px', borderRadius: '20px', border: '1px solid var(--general-section-1)' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-success)' }} />
                <span style={{ fontSize: '10px', color: 'var(--text-less-prominent)' }}>API {ping ? `${ping}ms` : 'Connected'}</span>
            </div>
        </div>
    );
});
