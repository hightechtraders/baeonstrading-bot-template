// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (Chart-Resilient Stream)
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const TARGET_SYMBOL = 'R_10';

let isInitialized = false;

// Declare the message handler globally so it stays persistent across tab switches
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

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isMounted = true;

        const setupFeed = async () => {
            try {
                while (!api_base?.api) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    if (!isMounted) return;
                }

                const currentSocket = api_base.api.connection;
                if (currentSocket) {
                    // Always ensure listener is attached to the active socket
                    currentSocket.removeEventListener('message', handleGlobalMessage);
                    currentSocket.addEventListener('message', handleGlobalMessage);
                }

                // If a global subscription hasn't been established on this session yet
                if (!isInitialized) {
                    console.log("[AI Scanner]: Requesting persistent tick subscription...");
                    await api_base.api.send({
                        ticks: TARGET_SYMBOL,
                        subscribe: 1
                    });
                    isInitialized = true;
                }
            } catch (err) {
                console.error("[AI Scanner]: Feed setup error:", err);
            }
        };

        setupFeed();

        return () => {
            isMounted = false;
        };
    }, []);
};
