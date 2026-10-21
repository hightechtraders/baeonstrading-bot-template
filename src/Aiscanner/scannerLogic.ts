// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts (PART 1)
// ==========================================
import { Strategy, INITIAL_STRATEGIES } from './strategies';

export interface DerivTickResponse {
    msg_type: string;
    tick?: {
        symbol: string;
        quote: number;
        epoch: number;
        id: string;
    };
}

export class ScannerLogic {
    private strategies: Strategy[] = INITIAL_STRATEGIES.map(s => ({
        ...s,
        name: s.name || 'Volatility AI Scalper',
        symbol: s.symbol || '1HZ50V', 
        confidence: s.confidence || 50
    }));

    private priceBuffers: { [symbol: string]: number[] } = {};
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
    
    private activeSignalStrategyId: string | null = null;
    private signalLockExpiryEpoch: number = 0; 
    private readonly MIN_LOCK_DURATION_TICKS = 5; 
    private readonly DISENGAGE_THRESHOLD = 82; 
    private totalTicksReceived = 0;

    public static readonly SCANNER_MARKETS: string[] = [
        '1HZ50V', '1HZ75V', '1HZ10V', '1HZ100V', 'R_25', 'R_75', 'R_10'
    ];

    constructor() {
        console.log("[AI Scanner]: Strict threshold calculation engine initialized.");
    }

    private calculateEMA(prices: number[], period: number): number {
        if (prices.length === 0) return 0;
        if (prices.length < period) return prices[prices.length - 1];
        const k = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    }

    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length <= period) return 50;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff > 0) gains += diff; else losses += Math.abs(diff);
        }
        if (losses === 0) return 100;
        return 100 - (100 / (1 + (gains / losses)));
    }

    private calculateBollingerBandsPercent(prices: number[], period: number = 20, multiplier: number = 2): number {
        if (prices.length < period) return 0.5;
        const slice = prices.slice(-period);
        const mean = slice.reduce((sum, val) => sum + val, 0) / period;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const upperBand = mean + (multiplier * stdDev);
        const lowerBand = mean - (multiplier * stdDev);
        if (upperBand === lowerBand) return 0.5;
        return (prices[prices.length - 1] - lowerBand) / (upperBand - lowerBand);
    }
// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerLogic } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

const scanner = new ScannerLogic();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

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

        let intervalId: any = null;
        let isSubscribed = false;

        const attemptSubscription = async () => {
            if (isSubscribed) return;

            try {
                if (
                    api_base && 
                    api_base.api && 
                    api_base.api.connection && 
                    api_base.api.connection.readyState === WebSocket.OPEN
                ) {
                    console.log("[AI Scanner Feed]: Socket connection active. Dispatching isolated subscription tracks...");
                    
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                    isSubscribed = true;

                    // Sequenced looped execution completely prevents WebSocket race conditions
                    for (const symbolKey of ScannerLogic.SCANNER_MARKETS) {
                        api_base.api.send({
                            ticks: symbolKey,
                            subscribe: 1
                        });
                        console.log(` -> Channel connected for asset stream: ${symbolKey}`);
                        await delay(150); 
                    }

                    console.log("[AI Scanner Feed]: All multi-asset connection tracks active.");
                }
            } catch (err) {
                console.warn("[AI Scanner Feed]: Ingestion channel waiting for stability...", err);
                isSubscribed = false; 
            }
        };

        attemptSubscription();
        intervalId = setInterval(attemptSubscription, 1500);

        return () => {
            window.removeEventListener('deriv_live_tick' as any, handleLiveTick as EventListener);
            if (intervalId) clearInterval(intervalId);
            
            if (isSubscribed && api_base?.api?.connection?.readyState === WebSocket.OPEN) {
                try {
                    api_base.api.send({ forget_all: 'ticks' });
                    console.log("[AI Scanner Feed]: Closed subscription channels cleanly.");
                } catch (e) {
                    console.error("Cleanup error:", e);
                }
            }
        };
    }, []);
};
