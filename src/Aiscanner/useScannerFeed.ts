// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';

const scanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let intervalId: any = null;

        const checkAndConnectSocket = () => {
            // Locate active Deriv platform WebSocket instances globally 
            // (Adjust `(window as any). ДерivWS` or your platform's global socket variable if named differently)
            const activeWs: WebSocket = (window as any).ws || (window as any).activeSocket;

            if (activeWs && activeWs.readyState === WebSocket.OPEN) {
                console.log("[AI Scanner Feed]: Active Deriv WebSocket detected. Subscribing to markets...");
                
                // 1. Subscribe to all required scanner symbols
                scanner.subscribeAllMarkets(activeWs);

                // 2. Intercept incoming socket messages
                const originalOnMessage = activeWs.onmessage;
                activeWs.onmessage = (event) => {
                    if (originalOnMessage) {
                        originalOnMessage.call(activeWs, event);
                    }

                    try {
                        const data = JSON.parse(event.data);
                        
                        // Pass packet to scanner logic
                        const updatedStrategies = scanner.handleIncomingMessage(data);

                        // Broadcast updated strategies to FloatingAI modal
                        window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                            detail: { strategies: updatedStrategies }
                        }));
                    } catch (err) {
                        // Ignore non-json or malformed frames
                    }
                };

                if (intervalId) clearInterval(intervalId);
            }
        };

        // Poll briefly until the platform's global WebSocket initializes
        intervalId = setInterval(checkAndConnectSocket, 1000);
        checkAndConnectSocket();

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, []);
};
