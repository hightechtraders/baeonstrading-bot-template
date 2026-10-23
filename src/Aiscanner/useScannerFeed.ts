// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const TARGET_SYMBOL = 'R_10';

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleLiveTick = (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol === TARGET_SYMBOL && typeof price === 'number') {
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

        let isInitialized = false;

        const initializeR10Feed = async () => {
            if (isInitialized) return;
            isInitialized = true;

            // Wait until WebSocket connection is fully open
            while (!api_base?.api?.connection || api_base.api.connection.readyState !== WebSocket.OPEN) {
                await delay(300);
            }

            console.log("[AI Scanner]: WebSocket open. Subscribing to R_10 ticks...");

            // Listen to global raw socket messages to catch incoming R_10 ticks
            const rawConnection = api_base?.api?.connection;
            const globalMessageListener = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data?.msg_type === 'tick' && data?.tick && data.tick.symbol === TARGET_SYMBOL) {
                        window.dispatchEvent(new CustomEvent('deriv_live_tick', {
                            detail: { 
                                symbol: data.tick.symbol, 
                                price: Number(data.tick.quote) 
                            }
                        }));
                    }
                } catch (e) {}
            };

            if (rawConnection && typeof rawConnection.addEventListener === 'function') {
                rawConnection.addEventListener('message', globalMessageListener);
            }

            // Send explicit subscription request exclusively for R_10
            try {
                if (typeof api_base?.api?.send === 'function') {
                    await api_base.api.send({
                        ticks: TARGET_SYMBOL,
                        subscribe: 1,
                        req_id: 5001
                    });
                    console.log("[AI Scanner]: R_10 tick subscription dispatched successfully.");
                }
            } catch (subErr) {
                console.error(`Sub error for ${TARGET_SYMBOL}:`, subErr);
            }
        };

        initializeR10Feed();

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            console.log("[AI Scanner]: Cleaning up R_10 feed...");
            
            try {
                if (typeof api_base?.api?.send === 'function') {
                    api_base.api.send({ forget_all: 'ticks' }).catch(() => {});
                }
            } catch (e) {}
        };
    }, []);
};
