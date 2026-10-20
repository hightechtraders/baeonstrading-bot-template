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

        let intervalId: any = null;
        let isSubscribed = false;

        const attemptSubscription = async () => {
            try {
                // Check if api_base connection is open and available
                if (api_base && api_base.api && api_base.api.connection && api_base.api.connection.readyState === WebSocket.OPEN) {
                    
                    // 1. Listen to raw WebSocket messages directly from Deriv API connection
                    const messageListener = (event: MessageEvent) => {
                        try {
                            const dataParsed = JSON.parse(event.data);
                            
                            if (dataParsed.msg_type === 'tick' && dataParsed.tick) {
                                const { symbol, quote, epoch, id } = dataParsed.tick;
                                
                                const updatedStrategies = scanner.handleIncomingMessage({
                                    msg_type: 'tick',
                                    tick: {
                                        symbol,
                                        quote: Number(quote),
                                        epoch: epoch || Math.floor(Date.now() / 1000),
                                        id: id || `${symbol}-${Date.now()}`
                                    }
                                });

                                if (updatedStrategies && updatedStrategies.length > 0) {
                                    window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                                        detail: { strategies: [...updatedStrategies] }
                                    }));
                                }
                            }
                        } catch (parseErr) {
                            // Ignore non-JSON or malformed frame messages
                        }
                    };

                    api_base.api.connection.addEventListener('message', messageListener);

                    // 2. Subscribe to all markets defined in SCANNER_MARKETS simultaneously
                    if (!isSubscribed) {
                        console.log("[AI Scanner Feed]: Connection open. Subscribing to all scanner markets...");
                        ScannerLogic.SCANNER_MARKETS.forEach((symbol: string) => {
                            api_base.api.send({
                                ticks: symbol,
                                subscribe: 1
                            });
                        });
                        isSubscribed = true;
                    }

                    if (intervalId) clearInterval(intervalId);
                }
            } catch (err) {
                console.warn("[AI Scanner Feed]: Waiting for socket stability...", err);
            }
        };

        // Try immediately, then poll every second until connection is open
        attemptSubscription();
        intervalId = setInterval(attemptSubscription, 1000);

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, []);
};
