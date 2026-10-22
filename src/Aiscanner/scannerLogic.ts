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
    
    // Sticky persistence state
    private activeSignalStrategyId: string | null = null;
    private readonly DISENGAGE_THRESHOLD = 82; 

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
        console.log("[AI Scanner]: Robust multi-tick momentum engine initialized.");
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
        
        // Maintain a healthy 60-tick rolling buffer per asset
        if (this.priceBuffers[symbol].length > 60) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices.length > 1 ? prices[prices.length - 2] : latestPrice;
        const netDiff = latestPrice - prevPrice;
        const liveDirection: 'UP' | 'DOWN' = netDiff >= 0 ? 'UP' : 'DOWN';

        // Track directional history for robust confluence checking
        if (!this.directionHistory[symbol]) {
            this.directionHistory[symbol] = [];
        }
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 8) {
            this.directionHistory[symbol].shift();
        }

        // ROBUST CONFLUENCE: Require at least 4 out of the last 5 ticks to agree (filters micro-whipsaws)
        const history = this.directionHistory[symbol];
        const recentSlice = history.slice(-5);
        const matchingDirectionCount = recentSlice.filter(d => d === liveDirection).length;
        const isConfluent = recentSlice.length >= 5 && matchingDirectionCount >= 4;

        let marketMomentum = 55; // Stable baseline
        if (prices.length >= 10) {
            const windowSize = Math.min(prices.length, 12);
            const oldestInWindow = prices[prices.length - windowSize];
            const priceDelta = latestPrice - oldestInWindow;
            const percentageChange = (priceDelta / oldestInWindow) * 100;
            
            // Clean magnitude scaling tailored to volatility index point values
            const scaleFactor = (symbol.includes('10') || symbol.includes('R_10')) ? 7500 : 5000;
            const rawMagnitude = Math.abs(percentageChange) * scaleFactor;
            const confluenceBonus = isConfluent ? 22 : 0;
            
            // Allow momentum to naturally scale up to 96% on genuine sustained trends
            marketMomentum = Math.min(96, Math.max(50, 55 + rawMagnitude + confluenceBonus));
        }

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat) => {
            // Contextual evaluation: Boost strategy score if its assigned market matches the live ticking symbol
            const isMatchingMarket = (strat.market || '').toUpperCase() === symbol.toUpperCase();
            const marketMultiplier = isMatchingMarket ? 1.0 : 0.88;

            let strategySpecificScore = Math.round(marketMomentum * marketMultiplier);
            strategySpecificScore = Math.min(96, Math.max(45, strategySpecificScore));

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

        // Sticky Signal Persistence Logic
        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD && isConfluent) {
                return this.getSortedStrategies();
            } else {
                this.activeSignalStrategyId = null;
            }
        }

        // Trigger new sticky signal when sweet spot (>= 89) is met with active confluence
        if (!this.activeSignalStrategyId && highestCalculatedScore >= 89 && isConfluent && topStrategyId) {
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
