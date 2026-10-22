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
                const tickData = data?.tick || data?.subscription?.tick;
                
                if (data?.msg_type === 'tick' && tickData) {
                    const updatedStrategies = scanner?.handleIncomingMessage({
                        msg_type: 'tick',
                        tick: { 
                            symbol: tickData.symbol, 
                            quote: Number(tickData.quote), 
                            epoch: Math.floor(Date.now() / 1000), 
                            id: `${tickData.symbol}-${Date.now()}` 
                        }
                    });

                    if (updatedStrategies && updatedStrategies.length > 0) {
                        // Send scored strategies back to the main UI thread
                        self.postMessage({ symbol, strategies: updatedStrategies });
                    }
                }
            } catch (e) {}
        };
    }
};
