// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (Reconnecting Singleton Stream)
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const TARGET_SYMBOL = 'R_10';

let globalSubscriptionId: string | null = null;
let lastConnectedSocket: any = null;

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

                const currentSocket = api_base.api.connection;

                // If the socket connection changed (e.g. navigation remounted socket), re-bind listener
                if (lastConnectedSocket === currentSocket && globalSubscriptionId) {
                    console.log("[AI Scanner]: Feed stream already active on current socket.");
                    return;
                }

                console.log("[AI Scanner]: Establishing active R_10 stream for current view...");
                
                const response = await api_base.api.send({
                    ticks: TARGET_SYMBOL,
                    subscribe: 1
                });

                if (response && response.subscription) {
                    globalSubscriptionId = response.subscription.id;
                }

                lastConnectedSocket = currentSocket;

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

                if (currentSocket) {
                    // Prevent duplicate event listeners if socket instance is the same
                    currentSocket.removeEventListener('message', handleGlobalMessage);
                    currentSocket.addEventListener('message', handleGlobalMessage);
                }

            } catch (err) {
                console.error("[AI Scanner]: Failed to initialize persistent feed", err);
            }
        };

        initializePersistentFeed();

        return () => {
            isMounted = false;
        };
    }, []);
};
