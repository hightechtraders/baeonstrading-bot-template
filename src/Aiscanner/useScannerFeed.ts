// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (FINAL CLEAN MULTI-MARKET DISPATCHER)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isInitialized = false;

        const initializeAllMarkets = async () => {
            if (isInitialized) return;
            isInitialized = true;

            // 1. Wait until WebSocket connection is fully open
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: WebSocket open. Dispatching all 7 market tick subscriptions...");

            // 2. Sequentially send subscription requests for all 7 markets with unique IDs
            let requestIdCounter = 7000;
            for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                try {
                    if (typeof api_base?.api?.send === 'function') {
                        requestIdCounter++;
                        await api_base.api.send({
                            ticks: symbolKey,
                            subscribe: 1,
                            req_id: requestIdCounter // Forces Deriv server to open a separate stream pipeline per asset
                        });
                    }
                    await delay(350); // Safe staggering gap to prevent server rate limiting
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: All 7 volatility pipelines requested successfully.");
        };

        initializeAllMarkets();

        return () => {
            console.log("[AI Scanner]: Cleaning up multi-market feeds...");
            ScannerLogic.SCANNER_MARKETS.forEach(symbolKey => {
                try {
                    api_base?.api?.send({ forget_all: 'ticks' }).catch(() => {});
                } catch (e) {}
            });
        };
    }, []);
};
