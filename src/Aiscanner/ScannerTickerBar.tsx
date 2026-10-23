// ==========================================
// FILE: src/Aiscanner/ScannerTickerBar.tsx
// ==========================================
import React, { useEffect, useState } from 'react';

export const ScannerTickerBar: React.FC = () => {
    const [liveData, setLiveData] = useState<{ symbol: string; price: number; direction: string } | null>(null);

    useEffect(() => {
        const handleTick = (event: CustomEvent) => {
            const { assetName, quote, symbol, price } = event.detail || {};
            const activeSymbol = assetName || symbol || 'R_10';
            const activePrice = quote !== undefined ? quote : price;

            if (activePrice !== undefined) {
                setLiveData((prev) => {
                    const prevPrice = prev?.price || activePrice;
                    const direction = activePrice >= prevPrice ? 'UP' : 'DOWN';
                    return { symbol: activeSymbol, price: activePrice, direction };
                });
            }
        };

        // Listen to all possible event names dispatched by your worker and bridge
        window.addEventListener('ai-tick-received' as any, handleTick as EventListener);
        window.addEventListener('deriv_scanner_updated' as any, handleTick as EventListener);
        window.addEventListener('deriv_live_tick' as any, handleTick as EventListener);

        return () => {
            window.removeEventListener('ai-tick-received' as any, handleTick as EventListener);
            window.removeEventListener('deriv_scanner_updated' as any, handleTick as EventListener);
            window.removeEventListener('deriv_live_tick' as any, handleTick as EventListener);
        };
    }, []);

    if (!liveData) {
        return (
            <div className="scanner-ticker-bar loading">
                <span>🛰️ Connecting to R_10 live feed...</span>
            </div>
        );
    }

    return (
        <div className="scanner-ticker-bar">
            <div className="ticker-info">
                <span className="ticker-symbol">{liveData.symbol}</span>
                <span className={`ticker-price ${liveData.direction.toLowerCase()}`}>
                    {liveData.price.toFixed(4)}
                </span>
            </div>
            <div className={`ticker-badge ${liveData.direction.toLowerCase()}`}>
                {liveData.direction === 'UP' ? '▲ RISING' : '▼ FALLING'}
            </div>
        </div>
    );
};
