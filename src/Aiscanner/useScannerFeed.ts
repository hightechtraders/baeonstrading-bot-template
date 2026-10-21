// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (OFFICIAL MULTI-MARKET SDK HOOK)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import { ScannerBridge } from './scannerBridge';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let activeUnsubscribers: (() => void)[] = [];
        let isInitialized = false;

        const initializeAllMarkets = async () => {
            if (isInitialized) return;
            isInitialized = true;

            // 1. Wait until WebSocket connection is fully open
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: WebSocket open. Registering dedicated SDK tick streams for all 7 markets...");

            // 2. Iterate through all scanner markets and bind via Deriv's native SDK
            for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                try {
                    if (typeof api_base?.api?.subscribeToTick === 'function') {
                        // Official SDK method assigns unique stream identifiers per symbol
                        const unsubscribeFn = api_base.api.subscribeToTick(symbolKey, (response: any) => {
                            if (response?.tick) {
                                const symbol = response.tick.symbol;
                                const price = Number(response.tick.quote);

                                // Push directly to your ScannerBridge for calculation & sorting
                                ScannerBridge.pushTick(symbol, price);

                                // Broadcast globally for any legacy components listening
                                window.dispatchEvent(
                                    new CustomEvent('deriv_live_tick', {
                                        detail: { symbol, price },
                                    })
                                );
                            }
                        });

                        if (typeof unsubscribeFn === 'function') {
                            activeUnsubscribers.push(unsubscribeFn);
                        }
                    }
                    await delay(350); // Stagger requests to prevent server-side rate limits
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: All 7 multi-market SDK streams successfully established.");
        };

        initializeAllMarkets();

        return () => {
            console.log("[AI Scanner]: Cleaning up multi-market SDK streams...");
            activeUnsubscribers.forEach(unsub => {
                try { unsub(); } catch (e) {}
            });
            activeUnsubscribers = [];
        };
    }, []);
};
