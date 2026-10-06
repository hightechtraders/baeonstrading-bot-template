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

        // 1. Listen to the global live tick events dispatched from api-base.ts
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

        // 2. Ensure markets are subscribed once the API connection is active/authorized
        const subscribeWhenReady = async () => {
            try {
                // Wait briefly for api_base to initialize
                let attempts = 0;
                while ((!api_base.api || !api_base.is_authorized) && attempts < 15) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    attempts++;
                }

                if (api_base.api && api_base.api.connection && api_base.api.connection.readyState === 1) {
                    console.log("[AI Scanner Feed]: API ready. Subscribing to scanner markets...");
                    ScannerLogic.SCANNER_MARKETS.forEach((symbol: string) => {
                        api_base.api?.send({ ticks: symbol, subscribe: 1 });
                    });
                }
            } catch (err) {
                console.error("[AI Scanner Feed]: Error subscribing to markets", err);
            }
        };

        subscribeWhenReady();

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
        };
    }, []);
};
