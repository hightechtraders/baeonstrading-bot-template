// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (PERSISTENT GLOBAL FEED)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Global execution flags to prevent re-triggering or socket duplication across tab changes
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

            console.log("[AI Scanner]: WebSocket open. Initializing persistent multi-market feeds...");

            const rawConnection = api_base?.api?.connection;
            
            // Attach global message listener only once globally
            if (rawConnection && typeof rawConnection.addEventListener === 'function' && !globalListenerAttached) {
                globalListenerAttached = true;
                rawConnection.addEventListener('message', (event: MessageEvent) => {
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
                });
            }

            // Send explicit subscription request for each market
            let requestIdCounter = 5000;
            for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                try {
                    if (typeof api_base?.api?.send === 'function') {
                        requestIdCounter++;
                        await api_base.api.send({
                            ticks: symbolKey,
                            subscribe: 1,
                            req_id: requestIdCounter
                        });
                    }
                    await delay(250);
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: Persistent multi-asset pipelines active.");
        };

        initializeAllMarkets();

        // CLEANUP NOTE: We intentionally remove `forget_all` here. 
        // This ensures switching to the Charts tab or other views NEVER kills your data pipeline.
        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
        };
    }, []);
};
