// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (DEDICATED SCANNER SOCKET FEED)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let isFeedInitialized = false;
let scannerSocket: WebSocket | null = null;

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

        const initializeDedicatedSocket = async () => {
            if (isFeedInitialized) return;
            isFeedInitialized = true;

            const APP_ID = '34t7y3xkywoxWNnZuZFaB'; // Your official Deriv App ID
            const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

            console.log("[AI Scanner]: Opening dedicated multi-asset WebSocket connection...");
            scannerSocket = new WebSocket(wsUrl);

            scannerSocket.onopen = async () => {
                if (!isMounted) return;
                console.log("[AI Scanner]: Socket open. Subscribing to all 7 markets...");

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
                        await delay(250); // Pacing delay to prevent throttling
                    } catch (subErr) {
                        console.error(`Sub error for ${symbolKey}:`, subErr);
                    }
                }
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
                console.warn("[AI Scanner]: Socket closed. Reconnecting...");
                isFeedInitialized = false;
                setTimeout(initializeDedicatedSocket, 3000);
            };
        };

        initializeDedicatedSocket();

        return () => {
            isMounted = false;
            isFeedInitialized = false;
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (scannerSocket) {
                scannerSocket.close();
            }
        };
    }, []);
};
