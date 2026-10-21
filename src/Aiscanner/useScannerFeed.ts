// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (FIXED UNIQUE REQ_ID MULTI-MARKET)
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

        let isInitialized = false;

        const initializeAllMarkets = async () => {
            if (isInitialized) return;
            isInitialized = true;

            // Wait until WebSocket connection is fully open
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: WebSocket open. Dispatching multi-market tick subscriptions with unique IDs...");

            // Listen to global raw socket messages to catch incoming ticks for all 7 symbols
            const rawConnection = api_base?.api?.connection;
            const globalMessageListener = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data?.msg_type === 'tick' && data?.tick) {
                        window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                            detail: { 
                                symbol: data.tick.symbol, 
                                price: Number(data.tick.quote) 
                            }
                        }));
                    }
                } catch (e) {}
            };

            if (rawConnection && typeof rawConnection.addEventListener === 'function') {
                rawConnection.addEventListener('message', globalMessageListener);
            }

            // Send explicit subscription request for each market with a unique req_id counter
            let requestIdCounter = 5000;
            for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                try {
                    if (typeof api_base?.api?.send === 'function') {
                        requestIdCounter++;
                        await api_base.api.send({
                            ticks: symbolKey,
                            subscribe: 1,
                            req_id: requestIdCounter // 🔑 Forces the server to handle each asset stream uniquely
                        });
                    }
                    await delay(250); // Stagger requests slightly to prevent rate limits
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: All 7 multi-asset pipelines dispatched successfully.");
        };

        initializeAllMarkets();

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            console.log("[AI Scanner]: Cleaning up multi-market feeds...");
            
            // Unsubscribe from markets on cleanup to keep socket clean
            ScannerLogic.SCANNER_MARKETS.forEach(symbolKey => {
                try {
                    api_base?.api?.send({ forget_all: 'ticks' }).catch(() => {});
                } catch (e) {}
            });
        };
    }, []);
};
