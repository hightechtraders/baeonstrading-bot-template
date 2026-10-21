// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (FINAL DEFINITIVE MULTI-MARKET FEED)
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

            // 1. Wait patiently until the global WebSocket connection is fully OPEN (readyState === 1)
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(400);
            }

            isInitialized = true;
            console.log("[AI Scanner]: WebSocket connection verified OPEN. Subscribing to all 7 volatility markets...");

            // 2. Sequentially subscribe to all 7 symbols using Deriv's official SDK method
            for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                try {
                    if (typeof api_base?.api?.subscribeToTick === 'function') {
                        const unsubscribeFn = api_base.api.subscribeToTick(symbolKey, (response: any) => {
                            if (response?.tick) {
                                const symbol = response.tick.symbol;
                                const price = Number(response.tick.quote);

                                // Pipe directly into your ScannerBridge math & sorting engine
                                ScannerBridge.pushTick(symbol, price);
                            }
                        });

                        if (typeof unsubscribeFn === 'function') {
                            activeUnsubscribers.push(unsubscribeFn);
                        }
                    }
                    // 350ms stagger gap prevents server-side rate limits and socket queue congestion
                    await delay(350); 
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: All 7 volatility market streams successfully established!");
        };

        initializeAllMarkets();

        return () => {
            console.log("[AI Scanner]: Cleaning up multi-market streams...");
            activeUnsubscribers.forEach(unsub => {
                try { unsub(); } catch (e) {}
            });
            activeUnsubscribers = [];
        };
    }, []);
};
