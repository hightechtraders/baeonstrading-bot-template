// ==========================================
// FILE: src/Aiscanner/scanner.worker.ts
// ==========================================
import { ScannerLogic } from './scannerLogic';

let scanner: ScannerLogic | null = null;
let socket: WebSocket | null = null;

const TARGET_SYMBOL = "R_10"; // Hardcoded to Volatility 10 Index

self.onmessage = (event) => {
    const { type, appId } = event.data;

    if (type === 'START_TRACKING') {
        scanner = new ScannerLogic();
        const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
        
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            socket?.send(JSON.stringify({
                ticks: TARGET_SYMBOL,
                subscribe: 1,
                req_id: Math.floor(Math.random() * 10000)
            }));
        };

        socket.onmessage = (msgEvent) => {
            try {
                const data = JSON.parse(msgEvent.data);
                
                if (data.error) {
                    console.error(`[Worker Error for ${TARGET_SYMBOL}]:`, data.error.message);
                    return;
                }

                const tickData = data?.tick || data?.subscription?.tick;
                
                if (data?.msg_type === 'tick' && tickData) {
                    const resolvedSymbol = tickData.symbol || TARGET_SYMBOL;

                    // Strict guard: Drop any tick data that isn't R_10
                    if (resolvedSymbol !== TARGET_SYMBOL) {
                        return;
                    }

                    const resolvedQuote = Number(tickData.quote || tickData.ask || tickData.bid);
                    if (isNaN(resolvedQuote)) return;

                    const updatedStrategies = scanner?.handleIncomingMessage({
                        msg_type: 'tick',
                        tick: { 
                            symbol: TARGET_SYMBOL, 
                            quote: resolvedQuote, 
                            epoch: tickData.epoch || Math.floor(Date.now() / 1000), 
                            id: `${TARGET_SYMBOL}-${Date.now()}` 
                        }
                    });

                    if (updatedStrategies && updatedStrategies.length > 0) {
                        // ✨ FIXED: Include quote so useScannerFeed can broadcast live prices to the UI ticker
                        self.postMessage({ 
                            symbol: TARGET_SYMBOL, 
                            quote: resolvedQuote, 
                            strategies: updatedStrategies 
                        });
                    }
                }
            } catch (e) {
                console.error(`[Worker Parse Exception]:`, e);
            }
        };

        socket.onerror = (error) => {
            console.error(`[WebSocket Error for ${TARGET_SYMBOL}]:`, error);
        };
    }

    if (type === 'STOP_TRACKING') {
        if (socket) {
            socket.close();
            socket = null;
        }
    }
};
