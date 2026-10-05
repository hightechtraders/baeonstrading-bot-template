import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { scannerBridge } from './scannerBridge';
import { CORE_7_STRATEGIES } from './strategies';

const globalScanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let pollTimer: NodeJS.Timeout;
        let hasSubscribed = false;
        let activeWs: WebSocket | null = null;

        const connectAndSubscribe = () => {
            const appStore = (window as any).derivBotAppStore;
            const isAuthorized = appStore?.client?.is_logged_in || localStorage.getItem('active_loginid');
            const ws = appStore?.client?.ws || (window as any).ws || (window as any).derivSocket;

            if (isAuthorized && ws && ws.readyState === WebSocket.OPEN) {
                if (!hasSubscribed || activeWs !== ws) {
                    console.log("[AI Scanner]: Connected to Deriv template socket. Subscribing to markets...");
                    globalScanner.subscribeAllMarkets(ws);
                    
                    // Attach message handler directly to the WebSocket instance
                    ws.addEventListener('message', handleSocketMessage);

                    hasSubscribed = true;
                    activeWs = ws;
                }
            }
        };

        const handleSocketMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.msg_type === 'tick' && data.tick) {
                    // Feed directly into your existing ScannerLogic parser
                    const updatedStrategies = globalScanner.handleIncomingMessage(data);

                    // Push to your UI bridge
                    const { symbol, quote } = data.tick;
                    const assetName = symbol; 
                    scannerBridge.pushTick(assetName, Number(quote), CORE_7_STRATEGIES);

                    // Broadcast UI update event for FloatingAI modal
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: updatedStrategies }
                    }));
                }
            } catch (err) {
                // Silently ignore non-JSON frames
            }
        };

        // Poll every second until the platform socket and auth store are open
        pollTimer = setInterval(connectAndSubscribe, 1000);

        return () => {
            clearInterval(pollTimer);
            if (activeWs) {
                activeWs.removeEventListener('message', handleSocketMessage);
            }
        };
    }, []);
};
