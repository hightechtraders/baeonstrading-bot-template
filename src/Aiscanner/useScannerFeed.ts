// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();

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

        // 2. Intercept the Template Master Stream directly at the WebSocket level
        let subscriptionLoopInterval: any = null;
        let isInterceptActive = false;

        const injectScannerToMasterStream = () => {
            if (isInterceptActive) return;

            try {
                const nativeSocket = api_base?.api?.connection;

                if (nativeSocket && nativeSocket.readyState === WebSocket.OPEN) {
                    console.log("[AI Scanner Intercept]: Master stream intercepted. Injecting multi-asset triggers...");
                    
                    if (subscriptionLoopInterval) {
                        clearInterval(subscriptionLoopInterval);
                        subscriptionLoopInterval = null;
                    }
                    isInterceptActive = true;

                    // Tap directly into the open socket's message event pipeline
                    const originalOnMessage = nativeSocket.onmessage;

                    nativeSocket.onmessage = function (event: MessageEvent) {
                        try {
                            const data = JSON.parse(event.data);
                            
                            // Whenever ANY tick flies through the master template connection, push it to our logic arrays
                            if (data?.msg_type === 'tick' && data?.tick) {
                                window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                    detail: {
                                        symbol: data.tick.symbol,
                                        price: Number(data.tick.quote)
                                    }
                                }));
                            }
                        } catch (e) {
                            // Fall through quietly
                        }

                        // Maintain native functionality so your Blockly blocks and strategy charts still execute perfectly
                        if (originalOnMessage) {
                            originalOnMessage.call(nativeSocket, event);
                        }
                    };

                    // Force the template connection to open streaming pipelines for all scanner markets safely
                    ScannerLogic.SCANNER_MARKETS.forEach((symbolKey, index) => {
                        setTimeout(() => {
                            if (nativeSocket.readyState === WebSocket.OPEN) {
                                nativeSocket.send(JSON.stringify({
                                    ticks: symbolKey,
                                    subscribe: 1
                                }));
                                console.log(` -> Master channel routed for: ${symbolKey}`);
                            }
                        }, index * 200); // 200ms stagger window to completely avoid rate limits and timeouts
                    });
                }
            } catch (err) {
                console.warn("[AI Scanner Intercept]: Waiting for master connection lines to warm up...", err);
                isInterceptActive = false;
            }
        };

        injectScannerToMasterStream();
        subscriptionLoopInterval = setInterval(injectScannerToMasterStream, 1500);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (subscriptionLoopInterval) clearInterval(subscriptionLoopInterval);
        };
    }, []);
};
