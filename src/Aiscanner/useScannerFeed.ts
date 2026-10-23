// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (Global Singleton Stream)
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const TARGET_SYMBOL = 'R_10';

// Global singletons to persist across route changes and unmounts
let isGloballyInitialized = false;
let globalSubscriptionId: string | null = null;

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isMounted = true;

        const initializePersistentFeed = async () => {
            try {
                while (!api_base?.api) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (!isMounted) return;
                }

                // If already initialized globally, just ensure listener is active and return
                if (isGloballyInitialized && api_base.api) {
                    console.log("[AI Scanner]: Feed already active globally across navigation.");
                    return;
                }

                console.log("[AI Scanner]: Establishing global R_10 persistent feed...");
                
                const response = await api_base.api.send({
                    ticks: TARGET_SYMBOL,
                    subscribe: 1
                });

                if (response && response.subscription) {
                    globalSubscriptionId = response.subscription.id;
                    isGloballyInitialized = true;
                }

                // Global message handler attached directly to connection
                const handleGlobalMessage = (event: MessageEvent) => {
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
                    api_base.api.connection.addEventListener('message', handleGlobalMessage);
                }

            } catch (err) {
                console.error("[AI Scanner]: Failed to initialize persistent feed", err);
                isGloballyInitialized = false;
            }
        };

        initializePersistentFeed();

        // Intentionally DO NOT call forget or teardown on component unmount 
        // so switching to the Charts tab never kills the background data stream.
        return () => {
            isMounted = false;
        };
    }, []);
};
