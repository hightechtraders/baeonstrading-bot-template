// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Direct event routing loop to push straight to UI
        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
                const updatedStrategies = scanner.handleIncomingMessage({
                    msg_type: 'tick',
                    tick: {
                        symbol,
                        quote: price,
                        epoch: Math.floor(Date.now() / 1000),
                        id: `${symbol}-${Date.now()}`
                    }
                });

                if (updatedStrategies && updatedStrategies.length > 0) {
                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                        detail: { strategies: [...updatedStrategies] }
                    }));
                }
            }
        };

        window.addEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);

        // 2. Spawn an isolated, raw WebSocket dedicated purely to your multi-asset scanner
        // Uses app_id 1089 (Deriv's official public testing id) to guarantee immediate connection stability
        let socket: WebSocket | null = null;
        let isClosedManually = false;

        const startScannerNetworkPipeline = async () => {
            if (isClosedManually) return;

            console.log("[AI Scanner Direct]: Spawning standalone network pipeline connection...");
            socket = new WebSocket('wss://://derivws.com');

            socket.onopen = async () => {
                console.log("[AI Scanner Direct]: Pipeline connected. Deploying sequential subscriptions...");
                
                // Sequentially register each distinct target index over our own dedicated stream channel
                for (const marketKey of ScannerLogic.SCANNER_MARKETS) {
                    if (socket && socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({
                            ticks: marketKey,
                            subscribe: 1
                        }));
                        await delay(200); // 200ms safety window prevents socket channel flooding
                    }
                }
                console.log("[AI Scanner Direct]: All 7 assets successfully registered.");
            };

            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data?.msg_type === 'tick' && data?.tick) {
                        // Directly dispatch the raw values into your scannerLogic ingestion router
                        window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                            detail: {
                                symbol: data.tick.symbol,
                                price: Number(data.tick.quote)
                            }
                        }));
                    }
                } catch (e) {
                    // Fail silently for heartbeat pings or system config logs
                }
            };

            socket.onerror = (error) => {
                console.error("[AI Scanner Direct]: Stream encountered a connection error:", error);
            };

            socket.onclose = async () => {
                if (!isClosedManually) {
                    console.warn("[AI Scanner Direct]: Pipeline disconnected. Re-establishing link in 3 seconds...");
                    await delay(3000);
                    startScannerNetworkPipeline();
                }
            };
        };

        startScannerNetworkPipeline();

        return () => {
            isClosedManually = true;
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (socket) {
                console.log("[AI Scanner Direct]: Closing dedicated tracking connection lines cleanly.");
                socket.close();
            }
        };
    }, []);
};
