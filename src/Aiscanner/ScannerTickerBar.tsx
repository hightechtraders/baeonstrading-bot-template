// ==========================================
// FILE: src/Aiscanner/ScannerTickerBar.tsx (Synced with AI Engine)
// ==========================================
import React, { useEffect, useRef, useState } from 'react';

interface ScannerTickerBarProps {
    selectedMarket?: string;
}

interface TickerSnapshot {
    symbol: string;
    price: number;
    direction: string;
}

export const ScannerTickerBar: React.FC<ScannerTickerBarProps> = ({ selectedMarket = 'ALL' }) => {
    const [liveData, setLiveData] = useState<TickerSnapshot | null>(null);
    const cacheBySymbolRef = useRef<Record<string, TickerSnapshot>>({});
    const selectedMarketRef = useRef<string>(selectedMarket);

    useEffect(() => {
        selectedMarketRef.current = selectedMarket;

        if (selectedMarket === 'ALL') {
            const entries = Object.values(cacheBySymbolRef.current);
            if (entries.length > 0) {
                setLiveData(entries[entries.length - 1]);
            }
        } else {
            const cached = cacheBySymbolRef.current[selectedMarket];
            setLiveData(cached || null);
        }
    }, [selectedMarket]);

    useEffect(() => {
        const handleTick = (event: CustomEvent) => {
            const { assetName, quote, symbol, price, strategies } = event.detail || {};
            const incomingSymbol = assetName || symbol;
            const incomingPrice = quote !== undefined ? Number(quote) : Number(price);

            if (!incomingSymbol || Number.isNaN(incomingPrice)) return;

            // Scope strategy direction lookup strictly to the incoming symbol
            let aiDirection: string | null = null;
            if (Array.isArray(strategies) && strategies.length > 0) {
                const marketStrats = strategies
                    .filter((s: any) => s.market === incomingSymbol || s.symbol === incomingSymbol)
                    .sort((a: any, b: any) => b.confidence - a.confidence);

                if (marketStrats[0]?.direction) {
                    aiDirection = marketStrats[0].direction; // 'UP' or 'DOWN'
                }
            }

            const prevEntry = cacheBySymbolRef.current[incomingSymbol];
            const prevPrice = prevEntry?.price ?? incomingPrice;
            const tickDirection = incomingPrice >= prevPrice ? 'UP' : 'DOWN';
            const direction = aiDirection || prevEntry?.direction || tickDirection;

            const snapshot: TickerSnapshot = {
                symbol: incomingSymbol,
                price: incomingPrice,
                direction,
            };

            cacheBySymbolRef.current[incomingSymbol] = snapshot;

            const activeFilter = selectedMarketRef.current;
            if (activeFilter === 'ALL' || activeFilter === incomingSymbol) {
                setLiveData(snapshot);
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
        const targetLabel = selectedMarket === 'ALL' ? 'multi-volatility' : selectedMarket;
        return (
            <div className="scanner-ticker-bar loading">
                <span>🛰️ Connecting to {targetLabel} live feed...</span>
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
