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
    // Extract static templates (rules, stakes, barriers) from INITIAL_STRATEGIES
    private strategyTemplates = INITIAL_STRATEGIES;

    private priceBuffers: { [symbol: string]: number[] } = {};
    private assetScores: { [symbol: string]: number } = {};
    private assetDirections: { [symbol: string]: 'UP' | 'DOWN' } = {};
    private lastTickTimes: { [symbol: string]: number } = {};

    public static readonly SCANNER_MARKETS: Array<{ symbol: string; marketName: string; volatility: string }> = [
        { symbol: '1HZ50V', marketName: 'Volatility 50 (1s) Index', volatility: '50s' },
        { symbol: '1HZ75V', marketName: 'Volatility 75 (1s) Index', volatility: '75s' },
        { symbol: '1HZ10V', marketName: 'Volatility 10 (1s) Index', volatility: '10s' },
        { symbol: '1HZ100V', marketName: 'Volatility 100 (1s) Index', volatility: '100s' },
        { symbol: 'R_25', marketName: 'Volatility 25 Index', volatility: '25' },
        { symbol: 'R_75', marketName: 'Volatility 75 Index', volatility: '75' },
        { symbol: 'R_10', marketName: 'Volatility 10 Index', volatility: '10' }
    ];

    constructor() {
        console.log("[AI Scanner]: Fully Rotational Dynamic Engine Initialized.");
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
        this.lastTickTimes[symbol] = Date.now();
        
        if (this.priceBuffers[symbol].length > 35) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        const currentTime = Date.now();

        // Decay scores for all markets so inactive ones cool down toward 50%
        Object.keys(this.assetScores).forEach((sym) => {
            const current = this.assetScores[sym] || 50;
            const timeSinceLastTick = currentTime - (this.lastTickTimes[sym] || currentTime);
            const decayAmount = sym === symbol ? 1 : (timeSinceLastTick > 1500 ? 3 : 2);

            if (current > 50) {
                this.assetScores[sym] = Math.max(50, current - decayAmount);
            } else if (current < 50) {
                this.assetScores[sym] = Math.min(50, current + 1);
            }
        });

        // Compute technical indicators for the ticked symbol
        if (prices.length >= 20) {
            const emaFast = this.calculateEMA(prices, 5);
            const emaSlow = this.calculateEMA(prices, 13);
            const rsi = this.calculateRSI(prices, 14);
            const { percentB, direction } = this.calculateBollingerBandPercentB(prices, 20);

            this.assetDirections[symbol] = direction;

            let score = 50;
            const isEmaBullish = emaFast > emaSlow;
            const isEmaBearish = emaFast < emaSlow;
            const isTrendAligned = (direction === 'UP' && isEmaBullish) || (direction === 'DOWN' && isEmaBearish);

            if (isTrendAligned) {
                score += 18;
                if (rsi > 65 && direction === 'UP') score += 15;
                if (rsi < 35 && direction === 'DOWN') score += 15;
                if (percentB > 0.85 && direction === 'UP') score += 13;
                if (percentB < 0.15 && direction === 'DOWN') score += 13;
            } else {
                score -= 8;
            }

            const finalScore = Math.min(96, Math.max(40, Math.round(score)));
            this.assetScores[symbol] = finalScore;
        } else {
            if (!this.assetScores[symbol]) {
                this.assetScores[symbol] = 50;
            }
            this.assetDirections[symbol] = prices.length >= 2 && prices[prices.length - 1] >= prices[prices.length - 2] ? 'UP' : 'DOWN';
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        // 1. Gather all markets and attach their live scores & directions
        const marketRankings = ScannerLogic.SCANNER_MARKETS.map(({ symbol, marketName, volatility }) => {
            const score = this.assetScores[symbol] ?? 50;
            const direction = this.assetDirections[symbol] || 'UP';
            return { symbol, marketName, volatility, score, direction };
        });

        // 2. Sort by highest score first
        marketRankings.sort((a, b) => b.score - a.score);

        // 3. Map sorted markets dynamically into strategy cards so cards shuffle freely
        return marketRankings.map((marketData, index) => {
            const template = this.strategyTemplates[index % this.strategyTemplates.length];
            const marketScore = marketData.score;

            let dynamicStatus = 'medium';
            if (marketScore >= 75) dynamicStatus = 'high';
            else if (marketScore < 55) dynamicStatus = 'low';

            return {
                ...template,
                id: `strat-${index + 1}`,
                market: marketData.marketName,
                symbol: marketData.symbol,
                volatility: marketData.volatility,
                confidence: marketScore,
                score: marketScore,
                direction: marketData.direction,
                status: dynamicStatus
            };
        });
    }
}
