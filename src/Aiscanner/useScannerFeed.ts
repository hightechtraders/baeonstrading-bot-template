// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
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

        let intervalId: any = null;
        let isSubscribed = false;

        const attemptSubscription = async () => {
            if (isSubscribed) return;

            try {
                if (
                    api_base && 
                    api_base.api && 
                    api_base.api.connection && 
                    api_base.api.connection.readyState === WebSocket.OPEN
                ) {
                    console.log("[AI Scanner Feed]: Socket open. Dispatching anti-collision pipelines...");
                    
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                    isSubscribed = true;

                    for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                        api_base.api.send({
                            ticks: symbolKey,
                            subscribe: 1
                        });
                        await delay(150); 
                    }
                }
            } catch (err) {
                console.warn("[AI Scanner Feed]: Ingestion channel waiting for stability...", err);
                isSubscribed = false; 
            }
        };

        attemptSubscription();
        intervalId = setInterval(attemptSubscription, 1500);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (intervalId) clearInterval(intervalId);
            
            if (isSubscribed && api_base?.api?.connection?.readyState === WebSocket.OPEN) {
                try {
                    api_base.api.send({ forget_all: 'ticks' });
                } catch (e) {
                    console.error("Cleanup error:", e);
                }
            }
        };
    }, []);
};
