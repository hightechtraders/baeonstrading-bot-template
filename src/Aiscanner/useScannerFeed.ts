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

        // Listen directly to the raw live ticks coming from api-base.ts
        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
                // Process tick and get a brand-new sorted array reference
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
                    // Force dispatch event with deep-cloned array to guarantee React triggers re-render & re-ordering
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: [...updatedStrategies] }
                    }));
                }
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);

        // Ensure subscriptions are sent on active socket
        const triggerSubscriptions = async () => {
            let attempts = 0;
            while (attempts < 15) {
                if (api_base.api && api_base.api.connection && api_base.api.connection.readyState === 1) {
                    console.log("[AI Scanner Feed]: Active socket found. Subscribing to markets...");
                    ScannerLogic.SCANNER_MARKETS.forEach((symbol: string) => {
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
