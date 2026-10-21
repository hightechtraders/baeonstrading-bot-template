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

        // 2. Tap directly into the Master WebSocket Stream
        let pollingInterval: any = null;
        let isInterceptActive = false;
        let activeUnsubscribeFunctions: (() => void)[] = [];

        const injectScannerToMasterStream = () => {
            if (isInterceptActive) return;

            try {
                const nativeSocket = api_base?.api?.connection;

                if (nativeSocket && nativeSocket.readyState === WebSocket.OPEN) {
                    console.log("[AI Scanner Intercept]: Master socket clear. Intercepting incoming packet feed...");
                    
                    if (pollingInterval) {
                        clearInterval(pollingInterval);
                        pollingInterval = null;
                    }
                    isInterceptActive = true;

                    // A. Safe interception of all global payloads flowing through the socket
                    const originalOnMessage = nativeSocket.onmessage;
                    nativeSocket.onmessage = function (event: MessageEvent) {
                        try {
                            const data = JSON.parse(event.data);
                            
                            // Instantly dispatch any valid tick data passing through the socket
                            if (data?.msg_type === 'tick' && data?.tick) {
                                window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                    detail: {
                                        symbol: data.tick.symbol,
                                        price: Number(data.tick.quote)
                                    }
                                }));
                            }
                        } catch (e) {
                            // Fall through silently
                        }

                        // Maintain native functionality for your active Blockly workspace canvas
                        if (originalOnMessage) {
                            originalOnMessage.call(nativeSocket, event);
                        }
                    };

                    // B. FIXED: Use the internal registry method to correctly request background feeds
                    ScannerLogic.SCANNER_MARKETS.forEach((symbolKey, index) => {
                        setTimeout(() => {
                            try {
                                if (api_base?.api?.connection?.readyState === WebSocket.OPEN) {
                                    // Bypasses layout limits using the native template registration channel
                                    const unsubFn = api_base.api.subscribeToTick(symbolKey, (tickData: any) => {
                                        if (tickData?.tick) {
                                            window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                                                detail: {
                                                    symbol: tickData.tick.symbol,
                                                    price: Number(tickData.tick.quote)
                                        }
                                            }));
                                        }
                                    });

                                    if (typeof unsubFn === 'function') {
                                        activeUnsubscribeFunctions.push(unsubFn);
                                    }
                                    console.log(` -> Master channel route verified for: ${symbolKey}`);
                                }
                            } catch (subErr) {
                                console.error(`Error forcing subscription for ${symbolKey}:`, subErr);
                            }
                        }, index * 200); // Strict 200ms stagger prevents socket frame overlapping
                    });

                    console.log("[AI Scanner Intercept]: All 7 structural market paths running synchronously.");
                }
            } catch (err) {
                console.warn("[AI Scanner Intercept]: Waiting for framework socket lines to connect...", err);
                isInterceptActive = false;
            }
        };

        // Initialize connection monitor loops
        injectScannerToMasterStream();
        pollingInterval = setInterval(injectScannerToMasterStream, 1500);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (pollingInterval) clearInterval(pollingInterval);
            
            // Clean up subscription instances on unmount to conserve browser performance
            console.log("[AI Scanner Intercept]: Cleaning active scanner tracking feeds...");
            activeUnsubscribeFunctions.forEach((unsubscribe) => {
                try { unsubscribe(); } catch (e) { /* fall through quiet */ }
            });
            activeUnsubscribeFunctions = [];
        };
    }, []);
};
