// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (MULTI-SOCKET MULTI-ASSET FEED)
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';

const scanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        let isMounted = true;
        const activeSockets: WebSocket[] = [];

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

        const APP_ID = '34t7y3xkywoxWNnZuZFaB'; // Your official Deriv App ID

        // Open an independent isolated WebSocket connection for EACH market
        ScannerLogic.SCANNER_MARKETS.forEach((symbolKey, index) => {
            const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;
            const socket = new WebSocket(wsUrl);
            activeSockets.push(socket);

            socket.onopen = () => {
                if (!isMounted) return;
                console.log(`[AI Scanner Socket ${index + 1}]: Opened for ${symbolKey}`);
                socket.send(JSON.stringify({
                    ticks: symbolKey,
                    subscribe: 1,
                    req_id: 8000 + index
                }));
            };

            socket.onmessage = (event: MessageEvent) => {
                if (!isMounted) return;
                try {
                    const data = JSON.parse(event.data);
                    const tickData = data?.tick || data?.subscription?.tick;
                    if (data?.msg_type === 'tick' && tickData) {
                        console.log(`📡 [Tick Stream Ingest]: Symbol -> ${tickData.symbol} | Price -> ${tickData.quote}`);
                        
                        window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                            detail: { 
                                symbol: tickData.symbol, 
                                price: Number(tickData.quote) 
                            }
                        }));
                    }
                } catch (e) {}
            };

            socket.onerror = (err) => {
                console.error(`[AI Scanner Error for ${symbolKey}]:`, err);
            };
        });

        return () => {
            isMounted = false;
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            // Clean up and close all 7 background sockets on unmount
            activeSockets.forEach(socket => {
                if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                    socket.close();
                }
            });
        };
    }, []);
};
