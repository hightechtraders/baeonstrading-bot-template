// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();

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
                if (api_base && api_base.api && api_base.api.connection && api_base.api.connection.readyState === WebSocket.OPEN) {
                    console.log("[AI Scanner Feed]: Connection open. Subscribing to scanner markets...");
                    
                    ScannerLogic.SCANNER_MARKETS.forEach((symbol: string) => {
                        api_base.api.send({
                            ticks: symbol,
                            subscribe: 1
                        });
                    });

                    isSubscribed = true;
                    if (intervalId) clearInterval(intervalId);
                }
            } catch (err) {
                console.warn("[AI Scanner Feed]: Waiting for socket stability...", err);
            }
        };

        // Try immediately, then poll every second until successful
        attemptSubscription();
        intervalId = setInterval(attemptSubscription, 1000);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (intervalId) clearInterval(intervalId);
        };
    }, []);
};
