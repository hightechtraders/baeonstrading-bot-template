// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts (FIXED ACTIVE MOMENTUM)
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
        if (!dataParsed || dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }

        const { symbol, quote } = dataParsed.tick;

        // 🔍 RESTORED LIVE TICK CONSOLE LOG
        console.log(`[WebSocket Stream]: Ingesting ${symbol} | Quote: ${quote}`);

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

        // Dynamic starting baseline that reacts from the 2nd tick onwards
        let marketMomentum = 62; 
        
        if (prices.length >= 2) {
            const windowSize = Math.min(prices.length, 8);
            const oldestInWindow = prices[prices.length - windowSize];
            const priceDelta = latestPrice - oldestInWindow;
            const percentageChange = oldestInWindow !== 0 ? (priceDelta / oldestInWindow) * 100 : 0;
            
            // Scaled multipliers to ensure tick micro-movements trigger visible score changes
            const scaleFactor = (symbol.includes('10') || symbol.includes('R_10')) ? 9000 : 7000;
            const rawMagnitude = Math.abs(percentageChange) * scaleFactor;
            const confluenceBonus = isConfluent ? 12 : 0;
            
            // Micro-jitter prevents scores from flatlining during tight consolidation ranges
            const liveJitter = (prices.length % 2 === 0) ? 1.5 : -1.5;

            marketMomentum = Math.min(97, Math.max(52, 65 + rawMagnitude + confluenceBonus + liveJitter));
        }

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat, index) => {
            const spreadOffset = (index === 0) ? 0 : (index * 2);
            const microNoise = Math.sin(prices.length + index) * 1.5;

            let strategySpecificScore = Math.round(
                marketMomentum - spreadOffset + microNoise
            );

            strategySpecificScore = Math.min(97, Math.max(45, strategySpecificScore));

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

        // Trigger new sticky signal when sweet spot (>= 88) is met with active confluence
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
