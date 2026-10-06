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

        // 1. Listen to global live ticks dispatched from api-base.ts
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
                        detail: { strategies: updatedStrategies }
                    }));
                }
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);

        // 2. Aggressively push subscriptions as soon as api_base has an active connection
        const triggerSubscriptions = async () => {
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                if (api_base.api && api_base.api.connection && api_base.api.connection.readyState === 1) {
                    console.log("[AI Scanner Feed]: Active socket found. Dispatching scanner market subscriptions...");
                    ScannerLogic.SCANNER_MARKETS.forEach((symbol: symbol | string) => {
                        api_base.api?.send({ ticks: symbol, subscribe: 1 });
                    });
                    break;
                }
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        };

        triggerSubscriptions();

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
        };
    }, []);
};
