// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';

const scanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let activeSocket: WebSocket | null = null;

        // 1. Intercept native WebSocket connections to catch Deriv's socket dynamically
        const OriginalWebSocket = window.WebSocket;
        (window as any).WebSocket = function(url: string | URL, protocols?: string | string[]) {
            const ws = new OriginalWebSocket(url, protocols);
            activeSocket = ws;

            ws.addEventListener('open', () => {
                // Check if this socket connects to Deriv endpoints
                if (String(url).includes('deriv') || String(url).includes('binary')) {
                    console.log("[AI Scanner Feed]: Intercepted active Deriv WebSocket! Subscribing...");
                    scanner.subscribeAllMarkets(ws);
                }
            });

            ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    const updatedStrategies = scanner.handleIncomingMessage(data);

                    if (updatedStrategies && updatedStrategies.length > 0) {
                        window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                            detail: { strategies: updatedStrategies }
                        }));
                    }
                } catch (err) {
                    // Ignore non-json frames
                }
            });

            return ws;
        };

        // Copy static properties just in case
        Object.assign(window.WebSocket, OriginalWebSocket);

        // 2. Fallback check for any pre-existing global sockets
        const existingWs = (window as any).ws || (window as any).activeSocket || (window as any).BinarySocket;
        if (existingWs && existingWs.readyState === WebSocket.OPEN) {
            scanner.subscribeAllMarkets(existingWs);
        }

        return () => {
            // Restore native WebSocket on unmount
            window.WebSocket = OriginalWebSocket;
        };
    }, []);
};
