// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Route all global template ticks to the engine arrays
        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
                const updatedStrategies = scanner.handleIncomingMessage({
                    msg_type: 'tick',
                    tick: { symbol, quote: price, epoch: Math.floor(Date.now() / 1000), id: `${symbol}-${Date.now()}` }
                });
                if (updatedStrategies && updatedStrategies.length > 0) {
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: [...updatedStrategies] }
                    }));
                }
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);

        let activeUnsubscribeFunctions: (() => void)[] = [];
        let pollingInterval: any = null;
        let isSubscribed = false;

        const subscribeAllMarketsSequentially = async () => {
            if (isSubscribed) return;

            try {
                if (api_base?.api?.connection?.readyState === WebSocket.OPEN) {
                    console.log("[AI Scanner]: Connected. Spawning sequenced 7-market subscription track...");
                    
                    if (pollingInterval) clearInterval(pollingInterval);
                    isSubscribed = true;

                    // FIX: Sequenced asynchronously delayed subscription mapping loops
                    for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                        try {
                            const unsubFn = api_base.api.subscribeToTick(symbolKey, (tickData: any) => {
                                if (tickData?.tick) {
                                    window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                        detail: { symbol: tickData.tick.symbol, price: Number(tickData.tick.quote) }
                                    }));
                                }
                            });

                            if (typeof unsubFn === 'function') {
                                activeUnsubscribeFunctions.push(unsubFn);
                            }
                            await delay(150); // 150ms buffer prevents websocket channel overloading
                        } catch (subErr) {
                            console.error(`Sub error for ${symbolKey}:`, subErr);
                        }
                    }
                    console.log("[AI Scanner]: All 7 background asset pipelines online.");
                }
            } catch (err) {
                console.warn("[AI Scanner]: Waiting for connection lines to mature...", err);
                isSubscribed = false;
            }
        };

        subscribeAllMarketsSequentially();
        pollingInterval = setInterval(subscribeAllMarketsSequentially, 1500);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (pollingInterval) clearInterval(pollingInterval);
            
            console.log("[AI Scanner]: Releasing background active multi-market tracks...");
            activeUnsubscribeFunctions.forEach((unsubscribe) => {
                try { unsubscribe(); } catch (e) {}
            });
            activeUnsubscribeFunctions = [];
        };
    }, []);
};
