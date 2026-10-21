// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (OFFICIAL SDK MULTI-MARKET)
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

        let activeUnsubscribers: (() => void)[] = [];
        let isInitialized = false;

        const initializeAllMarkets = async () => {
            if (isInitialized) return;
            isInitialized = true;

            // Wait until WebSocket connection is fully open
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: WebSocket open. Subscribing to all 7 markets via official SDK...");

            for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                try {
                    // Use the official SDK subscription method which properly registers stream callbacks
                    if (typeof api_base?.api?.subscribeToTick === 'function') {
                        const unsubscribe = api_base.api.subscribeToTick(symbolKey, (response: any) => {
                            if (response?.tick) {
                                window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                    detail: { 
                                        symbol: response.tick.symbol, 
                                        price: Number(response.tick.quote) 
                                    }
                                }));
                            }
                        });

                        if (typeof unsubscribe === 'function') {
                            activeUnsubscribers.push(unsubscribe);
                        }
                    }
                    await delay(300); // Stagger to prevent socket rate limits
                } catch (subErr) {
                    console.error(`Sub error for ${symbolKey}:`, subErr);
                }
            }
            console.log("[AI Scanner]: Multi-market SDK subscriptions initialized.");
        };

        initializeAllMarkets();

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            console.log("[AI Scanner]: Cleaning up subscriptions...");
            activeUnsubscribers.forEach(unsub => {
                try { unsub(); } catch (e) {}
            });
            activeUnsubscribers = [];
        };
    }, []);
};
