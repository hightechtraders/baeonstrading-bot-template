// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (FIXED SINGLE-RUN MULTI-MARKET)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

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
        let isInitialized = false;

        const initializeAllMarkets = async () => {
            if (isInitialized) return;
            isInitialized = true;

            // Wait until WebSocket is fully open
            while (api_base?.api?.connection?.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: WebSocket open. Sequentially subscribing to all 7 markets...");

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
                    await delay(200); // Stable 200ms spacing to prevent socket congestion
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: All 7 multi-asset pipelines successfully established.");
        };

        initializeAllMarkets();

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            console.log("[AI Scanner]: Cleaning up multi-market subscriptions...");
            activeUnsubscribeFunctions.forEach((unsubscribe) => {
                try { unsubscribe(); } catch (e) {}
            });
            activeUnsubscribeFunctions = [];
        };
    }, []);
};
