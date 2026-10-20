// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();

// Helper helper function to prevent socket frame collisions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Listen directly to raw live ticks dispatched from api-base.ts
        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
                const updatedStrategies = scanner.handleIncomingMessage({
                    msg_type: 'tick',
                    tick: {
                        symbol,
                        quote: price,
                        epoch: Math.floor(Date.now() / 1000),
                        id: `${symbol}-${Date.now()}`
                    }
                });

                if (updatedStrategies && updatedStrategies.length > 0) {
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: [...updatedStrategies] }
                    }));
                }
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);

        // 2. Reliable subscription mechanism via api_base instance
        let intervalId: any = null;
        let isSubscribed = false;

        const attemptSubscription = async () => {
            if (isSubscribed) return;

            try {
                // Check if api_base connection is open and available
                if (
                    api_base && 
                    api_base.api && 
                    api_base.api.connection && 
                    api_base.api.connection.readyState === WebSocket.OPEN
                ) {
                    console.log("[AI Scanner Feed]: Connection open. Deploying sequenced multi-market stream...");
                    
                    // Stop polling immediately to prevent multiple execution loops
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                    isSubscribed = true;

                    // FIX: Process subscriptions sequentially with a 150ms delay to prevent dropped packets
                    for (const symbol of ScannerLogic.SCANNER_MARKETS) {
                        api_base.api.send({
                            ticks: symbol,
                            subscribe: 1
                        });
                        console.log(` -> Requested stream subscription channel for: ${symbol}`);
                        await delay(150); // Small breath window for the WebSocket buffer
                    }

                    console.log("[AI Scanner Feed]: All 7 scanner subscription channels successfully requested.");
                }
            } catch (err) {
                console.warn("[AI Scanner Feed]: Waiting for socket stability...", err);
                isSubscribed = false; // Reset to allow retry on next tick interval
            }
        };

        // Try immediately, then poll every 1.5 seconds if socket is still cold
        attemptSubscription();
        intervalId = setInterval(attemptSubscription, 1500);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (intervalId) clearInterval(intervalId);
            
            // Clean up subscriptions when navigating away to conserve bandwidth
            if (isSubscribed && api_base?.api?.connection?.readyState === WebSocket.OPEN) {
                try {
                    api_base.api.send({ forget_all: 'ticks' });
                    console.log("[AI Scanner Feed]: Cleaned up active tick listeners.");
                } catch (e) {
                    console.error("Failed to unsubscribe ticks:", e);
                }
            }
        };
    }, []);
};
