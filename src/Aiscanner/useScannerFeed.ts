import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { scannerBridge } from './scannerBridge';
import { CORE_7_STRATEGIES } from './strategies';

const globalScanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isSubscribed = false;

        const checkAndBind = () => {
            const appStore = (window as any).derivBotAppStore;
            const ws = appStore?.client?.ws || (window as any).ws;
            const isLoggedIn = appStore?.client?.is_logged_in;

            // Only subscribe once the user is logged in and the socket is fully open
            if (isLoggedIn && ws && ws.readyState === WebSocket.OPEN && !isSubscribed) {
                console.log("[AI Scanner]: Account authorized & socket open. Subscribing to markets...");
                
                globalScanner.subscribeAllMarkets(ws);
                isSubscribed = true;

                // Listen to messages directly from the verified operational socket
                ws.onmessage = (event: MessageEvent) => {
                    try {
                        const data = JSON.parse(event.data);
                        const updatedStrategies = globalScanner.handleIncomingMessage(data);

                        if (data.msg_type === 'tick' && data.tick) {
                            const { symbol, quote } = data.tick;
                            scannerBridge.pushTick(symbol, Number(quote), CORE_7_STRATEGIES);

                            window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                                detail: { strategies: updatedStrategies }
                            }));
                        }
                    } catch (err) {
                        // Ignore malformed payloads
                    }
                };
            }
        };

        // Check every 500ms until authorization and connection complete
        const interval = setInterval(checkAndBind, 500);

        return () => {
            clearInterval(interval);
        };
    }, []);
};
