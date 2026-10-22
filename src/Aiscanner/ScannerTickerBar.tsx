// ==========================================
// FILE: src/Aiscanner/ScannerTickerBar.tsx
// ==========================================
import React, { useEffect, useState } from 'react';

export const ScannerTickerBar: React.FC = () => {
    const [liveData, setLiveData] = useState<{ symbol: string; price: number; direction: string } | null>(null);

    useEffect(() => {
        const handleTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && price) {
                const prevPrice = liveData?.price || price;
                const direction = price >= prevPrice ? 'UP' : 'DOWN';
                setLiveData({ symbol, price, direction });
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleTick as EventListener);
        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleTick as EventListener);
        };
    }, [liveData?.price]);

    if (!liveData) {
        return (
            <div className="scanner-ticker-bar loading">
                <span>Connecting to live feed...</span>
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
