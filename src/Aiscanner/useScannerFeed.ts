// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (RELIABLE STREAM METHOD)
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const TARGET_SYMBOL = 'R_10';

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let subscriptionId: string | null = null;
        let isMounted = true;

        const startFeed = async () => {
            try {
                // Ensure api_base is ready
                while (!api_base?.api) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (!isMounted) return;
                }

                console.log("[AI Scanner]: Subscribing to R_10 via API base...");

                // Use Deriv API's explicit subscription call if available
                const response = await api_base.api.send({
                    ticks: TARGET_SYMBOL,
                    subscribe: 1
                });

                if (response && response.subscription) {
                    subscriptionId = response.subscription.id;
                }

                // Also listen to general incoming API responses for ticks
                const handleApiMessage = (event: MessageEvent) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data?.msg_type === 'tick' && data?.tick?.symbol === TARGET_SYMBOL) {
                            const quote = Number(data.tick.quote);
                            if (!isNaN(quote)) {
                                ScannerBridge.pushTick(TARGET_SYMBOL, quote);
                            }
                        }
                    } catch (e) {}
                };

                if (api_base.api.connection) {
                    api_base.api.connection.addEventListener('message', handleApiMessage);
                }

            } catch (err) {
                console.error("[AI Scanner]: Failed to subscribe to R_10 feed", err);
            }
        };

        startFeed();

        return () => {
            isMounted = false;
            try {
                if (api_base?.api) {
                    if (subscriptionId) {
                        api_base.api.send({ forget: subscriptionId }).catch(() => {});
                    } else {
                        api_base.api.send({ forget_all: 'ticks' }).catch(() => {});
                    }
                }
            } catch (e) {}
        };
    }, []);
};
