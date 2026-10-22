// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (PERSISTENT GLOBAL FEED)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let isFeedInitialized = false;
let globalListenerAttached = false;

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

        const initializeAllMarkets = async () => {
            if (isFeedInitialized) return;
            isFeedInitialized = true;

            // Wait until WebSocket connection is fully open
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: WebSocket open. Initializing parallel multi-market feeds...");

            const rawConnection = api_base?.api?.connection;
            
            // Attach global message listener once to catch ticks from all active subscriptions
            if (rawConnection && typeof rawConnection.addEventListener === 'function' && !globalListenerAttached) {
                globalListenerAttached = true;
                rawConnection.addEventListener('message', (event: MessageEvent) => {
                    try {
                        const data = JSON.parse(event.data);
                        // Catch both direct tick messages and subscription-wrapped tick streams
                        const tickData = data?.tick || data?.subscription?.tick;
                        if (data?.msg_type === 'tick' && tickData) {
                            window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                detail: { 
                                    symbol: tickData.symbol, 
                                    price: Number(tickData.quote) 
                                }
                            }));
                        }
                    } catch (e) {}
                });
            }

            // Send explicit subscription request for each market with unique sub parameters
            let requestIdCounter = 6000;
            for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                try {
                    if (typeof api_base?.api?.send === 'function') {
                        requestIdCounter++;
                        // Use individual subscription requests per symbol
                        await api_base.api.send({
                            ticks: symbolKey,
                            subscribe: 1,
                            req_id: requestIdCounter
                        });
                        console.log(`[AI Scanner]: Subscribed successfully to ${symbolKey}`);
                    }
                    await delay(300); // Small pacing buffer between requests to prevent socket throttling
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: All 7 multi-asset pipelines active.");
        };

        initializeAllMarkets();

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
        };
    }, []);
};
