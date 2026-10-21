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

        // 1. Process and route incoming platform events smoothly
        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
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

        // 2. Specialized Multi-Asset Tracker Registry
        let activeSubscriptions: (() => void)[] = [];
        let isSubscribed = false;
        let pollingInterval: any = null;

        const connectAllStreams = () => {
            if (isSubscribed) return;

            try {
                if (
                    api_base && 
                    api_base.api && 
                    api_base.api.connection && 
                    api_base.api.connection.readyState === WebSocket.OPEN
                ) {
                    console.log("[AI Scanner Feed]: Native system pipelines clear. Spawning parallel listeners...");
                    
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                    }
                    isSubscribed = true;

                    // Bind to the underlying workspace streams to keep multi-asset processing clear
                    ScannerLogic.SCANNER_MARKETS.forEach((symbolKey) => {
                        try {
                            // Utilizing native callback registry methods to guarantee data delivery bypass
                            const unsubscribeFn = api_base.api.subscribeToTick(symbolKey, (tickData: any) => {
                                if (tickData?.tick) {
                                    window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                        detail: { 
                                            symbol: tickData.tick.symbol, 
                                            price: Number(tickData.tick.quote) 
                                        }
                                    }));
                                }
                            });
                            
                            if (typeof unsubscribeFn === 'function') {
                                activeSubscriptions.push(unsubscribeFn);
                            }
                            console.log(` -> System listener initialized for: ${symbolKey}`);
                        } catch (streamErr) {
                            console.error(`Subscription crash for ${symbolKey}:`, streamErr);
                        }
                    });

                    console.log("[AI Scanner Feed]: All 7 parallel quantitative streams initialized.");
                }
            } catch (err) {
                console.warn("[AI Scanner Feed]: Ingestion channel waiting for platform readiness...", err);
                isSubscribed = false;
            }
        };

        // Try immediately, poll safely if channel is initializing cold
        connectAllStreams();
        pollingInterval = setInterval(connectAllStreams, 1500);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (pollingInterval) clearInterval(pollingInterval);
            
            // Execute native un-subscription pipelines cleanly on unmount
            console.log("[AI Scanner Feed]: Cleaning active scanner tracking streams...");
            activeSubscriptions.forEach((unsubscribe) => {
                try { unsubscribe(); } catch (e) { /* silent catch */ }
            });
            activeSubscriptions = [];
        };
    }, []);
};
