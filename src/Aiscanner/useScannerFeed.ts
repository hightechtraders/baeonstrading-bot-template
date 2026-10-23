// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const TARGET_SYMBOL = 'R_10';

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isInitialized = false;

        const initializeFeed = async () => {
            if (isInitialized) return;
            isInitialized = true;

            // Wait until Deriv's API WebSocket connection is fully open
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: Connected. Subscribing to R_10 live ticks...");

            const rawConnection = api_base.api.connection;

            // Intercept incoming raw ticks from the socket and push them straight to the bridge
            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data?.msg_type === 'tick' && data?.tick) {
                        const symbol = data.tick.symbol;
                        const quote = Number(data.tick.quote);

                        if (symbol === TARGET_SYMBOL && !isNaN(quote)) {
                            // 🔑 THIS IS THE CRITICAL LINK: Feeds quote straight into ScannerBridge & ScannerLogic
                            ScannerBridge.pushTick(symbol, quote);
                        }
                    }
                } catch (e) {
                    // Ignore parse errors on non-tick messages
                }
            };

            if (rawConnection && typeof rawConnection.addEventListener === 'function') {
                rawConnection.addEventListener('message', handleMessage);
            }

            // Send subscription request for R_10
            try {
                if (typeof api_base?.api?.send === 'function') {
                    await api_base.api.send({
                        ticks: TARGET_SYMBOL,
                        subscribe: 1,
                        req_id: 5001
                    });
                }
            } catch (err) {
                console.error("R_10 Subscription error:", err);
            }
        };

        initializeFeed();

        return () => {
            console.log("[AI Scanner]: Cleaning up R_10 feed...");
            try {
                if (typeof api_base?.api?.send === 'function') {
                    api_base.api.send({ forget_all: 'ticks' }).catch(() => {});
                }
            } catch (e) {}
        };
    }, []);
};
