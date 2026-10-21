// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Ingest ticks directly from the native active layout hook
        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            
            // Only feed Volatility 10 Index ticks to the scanner logic
            if (symbol === 'R_10' && typeof price === 'number') {
                const updatedStrategies = scanner.handleIncomingMessage({
                    msg_type: 'tick',
                    tick: {
                        symbol,
                        quote: price,
                        epoch: Math.floor(Date.now() / 1000),
                        id: `${symbol}-${Date.now()}`
                    }
                });

                if (updatedStrategies && updatedStrategies.length > 0) {
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: [...updatedStrategies] }
                    }));
                }
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);

        // 2. Safe, native background subscription using the core connection instance
        let unsubscribeFn: (() => void) | null = null;
        let pollingInterval: any = null;

        const subscribeSingleAsset = () => {
            if (unsubscribeFn) return;

            try {
                if (api_base?.api?.connection?.readyState === WebSocket.OPEN) {
                    console.log("[AI Scanner]: Connected. Initializing Volatility 10 pipeline...");
                    
                    if (pollingInterval) clearInterval(pollingInterval);

                    // Subscribe natively via the template interface to prevent collision errors
                    unsubscribeFn = api_base.api.subscribeToTick('R_10', (tickData: any) => {
                        if (tickData?.tick && tickData.tick.symbol === 'R_10') {
                            window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                detail: {
                                    symbol: tickData.tick.symbol,
                                    price: Number(tickData.tick.quote)
                                }
                            }));
                        }
                    });
                }
            } catch (err) {
                console.warn("[AI Scanner]: Waiting for core socket readiness...", err);
            }
        };

        subscribeSingleAsset();
        pollingInterval = setInterval(subscribeSingleAsset, 1000);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (pollingInterval) clearInterval(pollingInterval);
            if (unsubscribeFn) {
                console.log("[AI Scanner]: Unsubscribing Volatility 10 stream.");
                try { unsubscribeFn(); } catch (e) {}
            }
        };
    }, []);
};
