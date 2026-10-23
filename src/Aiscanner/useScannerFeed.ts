// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (Resilient Navigation Stream)
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
        let isSubscribedActive = false;

        const startFeed = async () => {
            try {
                while (!api_base?.api) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (!isMounted) return;
                }

                if (isSubscribedActive) return; // Prevent duplicate subscriptions

                console.log("[AI Scanner]: Subscribing to R_10 via API base...");
                const response = await api_base.api.send({
                    ticks: TARGET_SYMBOL,
                    subscribe: 1
                });

                if (response && response.subscription) {
                    subscriptionId = response.subscription.id;
                    isSubscribedActive = true;
                }

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

        // Re-establish feed automatically if user navigates back and window regains focus
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !isSubscribedActive) {
                startFeed();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            isMounted = false;
            isSubscribedActive = false;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            
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
