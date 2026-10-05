import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { scannerBridge } from './scannerBridge';
import { CORE_7_STRATEGIES } from './strategies';

const globalScanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isSubscribed = false;
        let activeWs: WebSocket | null = null;

        const handleSocketMessage = (event: MessageEvent) => {
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

        const checkAndBind = () => {
            const appStore = (window as any).derivBotAppStore;
            const ws = appStore?.client?.ws || (window as any).ws;
            const isLoggedIn = appStore?.client?.is_logged_in;

            if (isLoggedIn && ws && ws.readyState === WebSocket.OPEN) {
                if (!isSubscribed || activeWs !== ws) {
                    console.log("[AI Scanner]: Account authorized & socket open. Subscribing to markets...");
                    
                    globalScanner.subscribeAllMarkets(ws);
                    
                    // Use addEventListener so we share the stream safely without overriding the template
                    ws.addEventListener('message', handleSocketMessage);

                    isSubscribed = true;
                    activeWs = ws;
                }
            }
        };

        const interval = setInterval(checkAndBind, 500);

        return () => {
            clearInterval(interval);
            if (activeWs) {
                activeWs.removeEventListener('message', handleSocketMessage);
            }
        };
    }, []);
};
