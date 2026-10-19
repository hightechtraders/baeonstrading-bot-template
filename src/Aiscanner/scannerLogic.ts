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
        name: s.name && s.name !== 'Connecting to Live Deriv Feed...' ? s.name : 'Volatility 50 AI Scalper',
        market: s.market || '1HZ50V',
        confidence: s.confidence || 78
    }));
    private priceBuffers: { [symbol: string]: number[] } = {};
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
    
    private lockedUntil: number = 0;
    private lockedStrategyId: string | null = null;
    private readonly LOCK_DURATION_MS = 3000; // 3-second stable window for execution

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
        console.log("[AI Scanner]: Predictive momentum & confluence filter initialized.");
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        const now = Date.now();

        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        if (this.priceBuffers[symbol].length > 40) {
            this.priceBuffers[symbol].shift();
        }

        if (now < this.lockedUntil && this.lockedStrategyId) {
            return this.getSortedStrategies();
        }

        const prices = this.priceBuffers[symbol];
        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices.length > 1 ? prices[prices.length - 2] : latestPrice;
        const netDiff = latestPrice - prevPrice;
        const liveDirection: 'UP' | 'DOWN' = netDiff >= 0 ? 'UP' : 'DOWN';

        // Track directional history to check for multi-tick confluence
        if (!this.directionHistory[symbol]) {
            this.directionHistory[symbol] = [];
        }
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 5) {
            this.directionHistory[symbol].shift();
        }

        // Confluence Check: Are the last 3 ticks pointing in the exact same direction? (Cleaned slice parameter)
        const history = this.directionHistory[symbol];
        const isConfluent = history.length >= 3 && history.slice(-3).every(d => d === liveDirection);

        let baseScore = 60; // Lower baseline so weak markets don't trigger false flags
        if (prices.length >= 5) {
            const windowSize = Math.min(prices.length, 10);
            const oldestInWindow = prices[prices.length - windowSize];
            const priceDelta = latestPrice - oldestInWindow;
            const percentageChange = (priceDelta / oldestInWindow) * 100;
            
            // Scaled magnitude: optimizes Vol 10 micro-trends without altering other indices
            const scaleFactor = (symbol.includes('10') || symbol.includes('R_10')) ? 5500 : 4000;
            const rawMagnitude = Math.abs(percentageChange) * scaleFactor;
            
            // Boost score only if multi-tick confluence is met
            const confluenceBonus = isConfluent ? 15 : 0;
            
            baseScore = Math.round(Math.min(96, Math.max(55, 65 + rawMagnitude + confluenceBonus)));
        }

        let triggeredHighConfidence = false;
        let targetStrategyId = '';

        this.strategies = this.strategies.map((strat, index) => {
            const uniqueWave = Math.sin(prices.length + index) * 3; 
            const strategySpecificScore = Math.round(
                Math.min(97, Math.max(45, baseScore + uniqueWave))
            );

            // Require high score AND strict multi-tick confluence before flagging high signal
            if (strategySpecificScore >= 89 && isConfluent && !triggeredHighConfidence) {
                triggeredHighConfidence = true;
                targetStrategyId = strat.id || strat.name;
            }

            return {
                ...strat,
                confidence: strategySpecificScore,
                score: strategySpecificScore,
                direction: liveDirection
            };
        });

        if (triggeredHighConfidence && targetStrategyId) {
            this.lockedUntil = now + this.LOCK_DURATION_MS;
            this.lockedStrategyId = targetStrategyId;
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        if (Date.now() < this.lockedUntil && this.lockedStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => (s.id || s.name) === this.lockedStrategyId);
            if (index > 0) {
                const [lockedItem] = copy.splice(index, 1);
                copy.unshift(lockedItem);
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
