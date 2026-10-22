// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (ROBUST HEARTBEAT FEED)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let isFeedInitialized = false;
let scannerSocket: WebSocket | null = null;
let pingInterval: any = null;

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isMounted = true;

        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
                const updatedStrategies = scanner.handleIncomingMessage({
                    msg_type: 'tick',
                    tick: { symbol, quote: price, epoch: Math.floor(Date.now() / 1000), id: `${symbol}-${Date.now()}` }
                });
                if (updatedStrategies && updatedStrategies.length > 0) {
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: [...updatedStrategies] }
                    }));
                }
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);

        const initializeSocket = async () => {
            if (isFeedInitialized) return;
            isFeedInitialized = true;

            const APP_ID = '34t7y3xkywoxWNnZuZFaB';
            const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

            console.log("[AI Scanner]: Establishing persistent connection...");
            scannerSocket = new WebSocket(wsUrl);

            scannerSocket.onopen = async () => {
                if (!isMounted) return;
                console.log("[AI Scanner]: Connected. Initializing market subscriptions & heartbeat...");

                // Send a clear-all request first to wipe any stale subscriptions on the socket channel
                scannerSocket?.send(JSON.stringify({ forget_all: 'ticks' }));

                let requestIdCounter = 7000;
                for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                    if (!isMounted) break;
                    try {
                        if (scannerSocket && scannerSocket.readyState === WebSocket.OPEN) {
                            requestIdCounter++;
                            scannerSocket.send(JSON.stringify({
                                ticks: symbolKey,
                                subscribe: 1,
                                req_id: requestIdCounter
                            }));
                        }
                        await delay(300);
                    } catch (err) {
                        console.error(`Sub error for ${symbolKey}:`, err);
                    }
                }

                // Keep connection alive every 30 seconds to prevent server timeouts
                if (pingInterval) clearInterval(pingInterval);
                pingInterval = setInterval(() => {
                    if (scannerSocket && scannerSocket.readyState === WebSocket.OPEN) {
                        scannerSocket.send(JSON.stringify({ ping: 1 }));
                    }
                }, 30000);
            };

            scannerSocket.onmessage = (event: MessageEvent) => {
                if (!isMounted) return;
                try {
                    const data = JSON.parse(event.data);
                    const tickData = data?.tick || data?.subscription?.tick;
                    
                    if (data?.msg_type === 'tick' && tickData) {
                        window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                            detail: { 
                                symbol: tickData.symbol, 
                                price: Number(tickData.quote) 
                            }
                        }));
                    }
                } catch (e) {}
            };

            scannerSocket.onerror = (error) => {
                console.error("[AI Scanner Socket Error]:", error);
            };

            scannerSocket.onclose = () => {
                console.warn("[AI Scanner]: Connection lost. Reconnecting in 3s...");
                if (pingInterval) clearInterval(pingInterval);
                isFeedInitialized = false;
                setTimeout(initializeSocket, 3000);
            };
        };

        initializeSocket();

        return () => {
            isMounted = false;
            isFeedInitialized = false;
            if (pingInterval) clearInterval(pingInterval);
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (scannerSocket) {
                scannerSocket.close();
            }
        };
    }, []);
};
