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
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
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
        console.log("[AI Scanner]: Dynamic Multi-Asset Live Tracking Initialized.");
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        
        if (this.priceBuffers[symbol].length > 30) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        const liveDirection: 'UP' | 'DOWN' = prices.length >= 2 && prices[prices.length - 1] >= prices[prices.length - 2] ? 'UP' : 'DOWN';
        this.assetDirections[symbol] = liveDirection;

        // Apply a slight natural decay to all un-ticked asset scores so stale markets gradually drift back toward baseline (50%)
        Object.keys(this.assetScores).forEach((sym) => {
            if (sym !== symbol) {
                const current = this.assetScores[sym];
                if (current > 50) {
                    this.assetScores[sym] = Math.max(50, current - 1); // Gradual cooldown
                } else if (current < 50) {
                    this.assetScores[sym] = Math.min(50, current + 1);
                }
            }
        });

        // Only calculate advanced metrics if we have accumulated enough ticks (>= 20)
        if (prices.length >= 20) {
            const latestPrice = prices[prices.length - 1];
            const prevPrice = prices[prices.length - 2];
            const netDiff = latestPrice - prevPrice;

            if (!this.directionHistory[symbol]) {
                this.directionHistory[symbol] = [];
            }
            this.directionHistory[symbol].push(liveDirection);
            if (this.directionHistory[symbol].length > 10) {
                this.directionHistory[symbol].shift();
            }

            const history = this.directionHistory[symbol];
            const sameDirectionCount = history.filter(d => d === liveDirection).length;
            const isConfluent = history.length >= 3 && history.slice(-3).every(d => d === liveDirection);

            const sma20 = prices.slice(-20).reduce((acc, val) => acc + val, 0) / 20;
            const distanceToSMA = latestPrice - sma20;
            const isAlignedWithTrend = (distanceToSMA > 0 && liveDirection === 'UP') || (distanceToSMA < 0 && liveDirection === 'DOWN');

            let calculatedScore = 48;
            const absoluteDelta = Math.abs(netDiff);
            const scaleRef = symbol.includes('100') ? 0.5 : (symbol.includes('50') ? 0.2 : 0.05);
            calculatedScore += Math.min(20, (absoluteDelta / scaleRef) * 20);
            calculatedScore += history.length > 0 ? (sameDirectionCount / history.length) * 22 : 0;
            if (isAlignedWithTrend) calculatedScore += 15;

            // Introduce slight natural variance based on tick timestamp/price micro-fluctuation to prevent static integer locks
            const microJitter = (Math.random() * 4) - 2; // -2 to +2 jitter
            calculatedScore += microJitter;

            const finalStrategyScore = Math.min(96, Math.max(40, Math.round(calculatedScore)));
            this.assetScores[symbol] = finalStrategyScore;
        } else {
            // Warmup fallback state for assets still building their 20-tick buffer
            if (!this.assetScores[symbol]) {
                this.assetScores[symbol] = 50;
            }
        }

        // Always update strategies mapping using strat.symbol to match assetScores keys
        this.strategies = this.strategies.map((strat) => {
            const stratSymbol = strat.symbol || '1HZ50V';
            const marketScore = this.assetScores[stratSymbol] ?? 50;
            const marketDirection = this.assetDirections[stratSymbol] || strat.direction || 'UP';

            // Dynamically assign status badges based on real-time live confidence thresholds
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
        // Pure descending sort by live confidence score — highest scoring asset floats instantly to #1
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
