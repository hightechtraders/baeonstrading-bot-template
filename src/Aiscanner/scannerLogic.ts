// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts
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
        name: s.name && s.name !== 'Connecting to Live Deriv Feed...' ? s.name : 'Volatility AI Trend Scalper',
        market: s.market || 'Volatility 50 (1s) Index',
        symbol: s.symbol || '1HZ50V',
        confidence: s.confidence || 50
    }));
    
    private priceBuffers: { [symbol: string]: number[] } = {};
    private assetScores: { [symbol: string]: number } = {};
    private assetDirections: { [symbol: string]: 'UP' | 'DOWN' } = {};

    public static readonly SCANNER_MARKETS: string[] = [
        '1HZ50V',  // Volatility 50 (1s) Index
        '1HZ75V',  // Volatility 75 (1s) Index
        '1HZ10V',  // Volatility 10 (1s) Index
        '1HZ100V', // Volatility 100 (1s) Index
        'R_25',    // Volatility 25 Index
        'R_75',    // Volatility 75 Index
        'R_10'     // Volatility 10 Index
    ];

    constructor() {
        console.log("[AI Scanner]: True Indicator-Driven Engine Initialized (EMA, RSI, BB %B).");
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    private calculateEMA(prices: number[], period: number): number {
        if (prices.length === 0) return 0;
        const k = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = (prices[i] * k) + (ema * (1 - k));
        }
        return ema;
    }

    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) return 50;
        
        let gains = 0;
        let losses = 0;

        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses += Math.abs(diff);
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateBollingerBandPercentB(prices: number[], period: number = 20, stdDevMultiplier: number = 2): { percentB: number, direction: 'UP' | 'DOWN' } {
        if (prices.length < period) return { percentB: 0.5, direction: 'UP' };

        const slice = prices.slice(-period);
        const sma = slice.reduce((acc, val) => acc + val, 0) / period;
        
        const variance = slice.reduce((acc, val) => acc + Math.pow(val - sma, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        const upperBand = sma + (stdDevMultiplier * stdDev);
        const lowerBand = sma - (stdDevMultiplier * stdDev);
        const currentPrice = prices[prices.length - 1];

        const bandWidth = upperBand - lowerBand;
        const percentB = bandWidth === 0 ? 0.5 : (currentPrice - lowerBand) / bandWidth;
        const direction = currentPrice >= sma ? 'UP' : 'DOWN';

        return { percentB, direction };
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        
        if (this.priceBuffers[symbol].length > 35) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];

        // Apply natural cooldown/decay to un-ticked assets
        Object.keys(this.assetScores).forEach((sym) => {
            if (sym !== symbol) {
                const current = this.assetScores[sym];
                if (current > 50) this.assetScores[sym] = Math.max(50, current - 1);
                else if (current < 50) this.assetScores[sym] = Math.min(50, current + 1);
            }
        });

        // Compute indicators once buffer has enough data (>= 20 ticks)
        if (prices.length >= 20) {
            const emaFast = this.calculateEMA(prices, 5);
            const emaSlow = this.calculateEMA(prices, 13);
            const rsi = this.calculateRSI(prices, 14);
            const { percentB, direction } = this.calculateBollingerBandPercentB(prices, 20);

            this.assetDirections[symbol] = direction;

            // Scoring Logic based on technical indicators:
            // 1. EMA Crossover alignment (Fast above Slow = Bullish)
            let score = 50;
            const isEmaBullish = emaFast > emaSlow;
            const isEmaBearish = emaFast < emaSlow;

            if ((direction === 'UP' && isEmaBullish) || (direction === 'DOWN' && isEmaBearish)) {
                score += 15;
            }

            // 2. RSI Momentum bounds (Overbought > 70 or Oversold < 30 give strong directional weights)
            if (rsi > 60 && direction === 'UP') {
                score += ((rsi - 60) / 40) * 20; // Up to +20 points for strong upward RSI momentum
            } else if (rsi < 40 && direction === 'DOWN') {
                score += (((40 - rsi) / 40)) * 20; // Up to +20 points for strong downward RSI momentum
            }

            // 3. Bollinger Band %B Extremes (%B > 0.8 or %B < 0.2 indicates breakout pressure)
            if (percentB > 0.8 && direction === 'UP') {
                score += 12;
            } else if (percentB < 0.2 && direction === 'DOWN') {
                score += 12;
            }

            // Clamp score between 40 and 96
            const finalScore = Math.min(96, Math.max(40, Math.round(score)));
            this.assetScores[symbol] = finalScore;
        } else {
            if (!this.assetScores[symbol]) {
                this.assetScores[symbol] = 50;
            }
            this.assetDirections[symbol] = prices.length >= 2 && prices[prices.length - 1] >= prices[prices.length - 2] ? 'UP' : 'DOWN';
        }

        // Map scores to strategy cards
        this.strategies = this.strategies.map((strat) => {
            const stratSymbol = strat.symbol || '1HZ50V';
            const marketScore = this.assetScores[stratSymbol] ?? 50;
            const marketDirection = this.assetDirections[stratSymbol] || strat.direction || 'UP';

            let dynamicStatus = 'medium';
            if (marketScore >= 75) dynamicStatus = 'high';
            else if (marketScore < 55) dynamicStatus = 'low';

            return {
                ...strat,
                confidence: marketScore,
                score: marketScore,
                direction: marketDirection,
                status: dynamicStatus
            };
        });

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
