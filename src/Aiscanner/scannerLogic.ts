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
    
    // Sticky persistence state instead of time-locked windows
    private activeSignalStrategyId: string | null = null;
    private readonly DISENGAGE_THRESHOLD = 82; // Keeps signal active until confidence slides below this level

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
        console.log("[AI Scanner]: Sticky momentum & persistent signal filter initialized.");
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
        if (this.priceBuffers[symbol].length > 40) {
            this.priceBuffers[symbol].shift();
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

        // Confluence Check: Are the last 3 ticks pointing in the exact same direction?
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
            
            baseScore = Math.round(Math.min(97, Math.max(55, 65 + rawMagnitude + confluenceBonus)));
        }

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat, index) => {
            const uniqueWave = Math.sin(prices.length + index) * 3; 
            const strategySpecificScore = Math.round(
                Math.min(97, Math.max(45, baseScore + uniqueWave))
            );

            const stratId = strat.id || strat.name;
            if (strategySpecificScore > highestCalculatedScore) {
                highestCalculatedScore = strategySpecificScore;
                topStrategyId = stratId;
            }

            return {
                ...strat,
                confidence: strategySpecificScore,
                score: strategySpecificScore,
                direction: liveDirection
            };
        });

        // Sticky Signal Logic:
        // If we already have an active signal, keep it pinned as long as its score stays above DISENGAGE_THRESHOLD and confluence holds.
        // Otherwise, switch or disengage when momentum totally fades.
        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD && isConfluent) {
                // Keep current active signal locked in place
                return this.getSortedStrategies();
            } else {
                // Momentum faded or dropped below threshold, release active signal
                this.activeSignalStrategyId = null;
            }
        }

        // Trigger a new sticky signal if score hits the sweet spot (>= 89) with active confluence
        if (!this.activeSignalStrategyId && highestCalculatedScore >= 89 && isConfluent && topStrategyId) {
            this.activeSignalStrategyId = topStrategyId;
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        // If there is an active sticky signal, ensure it stays pinned at the very top index [0]
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
