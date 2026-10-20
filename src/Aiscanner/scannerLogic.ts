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
        market: s.market || '1HZ50V',
        confidence: s.confidence || 78
    }));
    
    private priceBuffers: { [symbol: string]: number[] } = {};
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
    
    private activeSignalStrategyId: string | null = null;
    private readonly DISENGAGE_THRESHOLD = 75; 

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
        console.log("[AI Scanner]: Structured Trend & Confluence Filter Initialized.");
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
        
        // Keep a healthy buffer size for moving average calculations (e.g., last 30 ticks)
        if (this.priceBuffers[symbol].length > 30) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        
        // Need at least 20 ticks to calculate a stable trend baseline
        if (prices.length < 20) {
            return this.getSortedStrategies();
        }

        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2];
        const netDiff = latestPrice - prevPrice;
        const liveDirection: 'UP' | 'DOWN' = netDiff >= 0 ? 'UP' : 'DOWN';

        // 1. Track Directional History (Confluence Check)
        if (!this.directionHistory[symbol]) {
            this.directionHistory[symbol] = [];
        }
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 5) {
            this.directionHistory[symbol].shift();
        }

        const history = this.directionHistory[symbol];
        // Require at least 3 consecutive ticks moving in the same direction
        const isConfluent = history.length >= 3 && history.slice(-3).every(d => d === liveDirection);

        // 2. Trend Environment Filter (Simple Moving Average of last 20 ticks)
        const sma20 = prices.slice(-20).reduce((acc, val) => acc + val, 0) / 20;
        const isAboveTrend = latestPrice > sma20;
        const isBelowTrend = latestPrice < sma20;

        // 3. Score Calculation based on structural alignment instead of noise
        let baseScore = 50;
        if ((isAboveTrend && liveDirection === 'UP') || (isBelowTrend && liveDirection === 'DOWN')) {
            baseScore = 70;
            if (isConfluent) {
                baseScore = 88; // High-probability sweet spot
            }
        } else {
            baseScore = 45; // Penalize counter-trend ticks
        }

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat, index) => {
            const spreadOffset = (index === 0) ? 0 : (index * 3);
            let strategyScore = Math.min(96, Math.max(40, baseScore - spreadOffset));

            const stratId = strat.id || strat.name;
            if (strategyScore > highestCalculatedScore) {
                highestCalculatedScore = strategyScore;
                topStrategyId = stratId;
            }

            return {
                ...strat,
                confidence: strategyScore,
                score: strategyScore,
                direction: liveDirection
            };
        });

        // 4. Sticky Signal Management
        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD) {
                return this.getSortedStrategies();
            } else {
                this.activeSignalStrategyId = null;
            }
        }

        // Trigger signal only when strict confluence and trend alignment hit >= 88 confidence
        if (!this.activeSignalStrategyId && highestCalculatedScore >= 88 && isConfluent && topStrategyId) {
            this.activeSignalStrategyId = topStrategyId;
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        if (this.activeSignalStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (index > 0) {
                const [stickyItem] = copy.splice(index, 1);
                copy.unshift(stickyItem);
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
