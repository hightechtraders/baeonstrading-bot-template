// ==========================================
// FILE: src/Aiscanner/ScannerTickerBar.tsx (Synced with AI Engine)
// ==========================================
import React, { useEffect, useState } from 'react';

export const ScannerTickerBar: React.FC = () => {
    const [liveData, setLiveData] = useState<{ symbol: string; price: number; direction: string } | null>(null);

    useEffect(() => {
        const handleTick = (event: CustomEvent) => {
            const { assetName, quote, symbol, price, strategies } = event.detail || {};
            const activeSymbol = assetName || symbol || 'R_10';
            const activePrice = quote !== undefined ? quote : price;

            if (activePrice !== undefined) {
                // If the event includes evaluated strategies, grab the top strategy's direction
                let aiDirection: string | null = null;
                if (Array.isArray(strategies) && strategies.length > 0) {
                    const sorted = [...strategies].sort((a, b) => b.confidence - a.confidence);
                    if (sorted[0]?.direction) {
                        aiDirection = sorted[0].direction; // 'UP' or 'DOWN'
                    }
                }

                setLiveData((prev) => {
                    const prevPrice = prev?.price || activePrice;
                    // Fallback to tick direction if AI direction isn't in payload yet
                    const tickDirection = activePrice >= prevPrice ? 'UP' : 'DOWN';
                    const direction = aiDirection || prev?.direction || tickDirection;

                    return { symbol: activeSymbol, price: activePrice, direction };
                });
            }
        };

        window.addEventListener('ai-tick-received' as any, handleTick as EventListener);
        window.addEventListener('deriv_scanner_updated' as any, handleTick as EventListener);
        window.addEventListener('ai-strategies-updated' as any, handleTick as EventListener);

        return () => {
            window.removeEventListener('ai-tick-received' as any, handleTick as EventListener);
            window.removeEventListener('deriv_scanner_updated' as any, handleTick as EventListener);
            window.removeEventListener('ai-strategies-updated' as any, handleTick as EventListener);
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
