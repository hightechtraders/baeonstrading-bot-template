// src/Aiscanner/scanner.worker.ts
import { ScannerLogic } from './scannerLogic';

let scanner: ScannerLogic | null = null;
let socket: WebSocket | null = null;

self.onmessage = (event) => {
    const { type, symbol, appId } = event.data;

    if (type === 'START_TRACKING') {
        scanner = new ScannerLogic();
        const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            socket?.send(JSON.stringify({
                ticks: symbol,
                subscribe: 1,
                req_id: Math.floor(Math.random() * 10000)
            }));
        };

        socket.onmessage = (msgEvent) => {
            try {
                const data = JSON.parse(msgEvent.data);
                
                // Log subscription confirmations or errors for debugging
                if (data.error) {
                    console.error(`[Worker Error for ${symbol}]:`, data.error.message);
                    return;
                }

                const tickData = data?.tick || data?.subscription?.tick;
                
                if (data?.msg_type === 'tick' && tickData) {
                    const resolvedSymbol = tickData.symbol || symbol;
                    const resolvedQuote = Number(tickData.quote || tickData.ask || tickData.bid);

                    if (isNaN(resolvedQuote)) return;

                    const updatedStrategies = scanner?.handleIncomingMessage({
                        msg_type: 'tick',
                        tick: { 
                            symbol: resolvedSymbol, 
                            quote: resolvedQuote, 
                            epoch: tickData.epoch || Math.floor(Date.now() / 1000), 
                            id: `${resolvedSymbol}-${Date.now()}` 
                        }
                    });

                    if (updatedStrategies && updatedStrategies.length > 0) {
                        self.postMessage({ symbol: resolvedSymbol, strategies: updatedStrategies });
                    }
                }
            } catch (e) {
                console.error(`[Worker Parse Exception for ${symbol}]:`, e);
            }
        };

        socket.onerror = (error) => {
            console.error(`[WebSocket Error for ${symbol}]:`, error);
        };
    }

    if (type === 'STOP_TRACKING') {
        if (socket) {
            socket.close();
            socket = null;
        }
    }
};
