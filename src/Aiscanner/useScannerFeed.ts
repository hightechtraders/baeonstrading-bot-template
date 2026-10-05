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
            // Check both standard store login flags and active connection sockets
            const isAuthorized = appStore?.client?.is_logged_in || localStorage.getItem('active_loginid');
            const ws = appStore?.client?.ws || (window as any).ws || (window as any).derivSocket;

            if (ws && ws.readyState === WebSocket.OPEN) {
                if (!hasSubscribed || activeWs !== ws) {
                    console.log("[AI Scanner]: Socket active. Triggering market subscriptions...");
                    
                    // Call your scanner logic's built-in subscription method
                    globalScanner.subscribeAllMarkets(ws);

                    // Attach message listener directly to the socket instance
                    ws.addEventListener('message', handleSocketMessage);

                    hasSubscribed = true;
                    activeWs = ws;
                }
            }
        };

        const handleSocketMessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                
                // Pass directly into your existing, well-built scannerLogic parser
                const updatedStrategies = globalScanner.handleIncomingMessage(data);

                if (data.msg_type === 'tick' && data.tick) {
                    const { symbol, quote } = data.tick;
                    
                    // Push live tick to bridge
                    scannerBridge.pushTick(symbol, Number(quote), CORE_7_STRATEGIES);

                    // Broadcast UI event to update your FloatingAI components
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: updatedStrategies }
                    }));
                }
            } catch (err) {
                // Silently ignore non-JSON frames
            }
        };

        // Poll every second until the socket is live and ready
        pollTimer = setInterval(connectAndSubscribe, 1000);

        return () => {
            clearInterval(pollTimer);
            if (activeWs) {
                activeWs.removeEventListener('message', handleSocketMessage);
            }
        };
    }, []);
};
