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
    
    // Sticky persistence state & thresholds (Disengage threshold updated to 85%)
    private activeSignalStrategyId: string | null = null;
    private readonly DISENGAGE_THRESHOLD = 85; 

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
        console.log("[AI Scanner]: Stable persistent banner logic initialized (85% threshold).");
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

        // Track directional history
        if (!this.directionHistory[symbol]) {
            this.directionHistory[symbol] = [];
        }
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 5) {
            this.directionHistory[symbol].shift();
        }

        let marketMomentum = 65; 
        let isBreakoutValid = false;

        if (prices.length >= 4) {
            const windowSize = Math.min(prices.length, 6);
            const baselinePrice = prices[prices.length - windowSize];
            const priceDelta = latestPrice - baselinePrice;
            const percentageChange = (priceDelta / baselinePrice) * 100;
            
            const scaleFactor = (symbol.includes('10') || symbol.includes('R_10')) ? 9000 : 7000;
            const rawMagnitude = Math.abs(percentageChange) * scaleFactor;

            const isMovingForward = netDiff !== 0;
            isBreakoutValid = rawMagnitude > 5 && isMovingForward;
            
            const breakoutBonus = isBreakoutValid ? 25 : 10;
            marketMomentum = Math.min(97, Math.max(50, 65 + rawMagnitude + breakoutBonus));
        }

        let highestCalculatedScore = 0;
        let potentialSweetSpotId = '';

        // Recalculate strategy scores on every tick
        this.strategies = this.strategies.map((strat, index) => {
            const spreadOffset = (index === 0) ? 0 : (index * 2);
            const microNoise = (Math.sin(prices.length + index) * 1.5);

            let strategySpecificScore = Math.round(
                marketMomentum - spreadOffset + microNoise
            );

            strategySpecificScore = Math.min(97, Math.max(45, strategySpecificScore));

            const stratId = strat.id || strat.name;
            
            if (strategySpecificScore > highestCalculatedScore) {
                highestCalculatedScore = strategySpecificScore;
            }

            // Flag strategy immediately if it crosses the 89% sweet spot
            if (strategySpecificScore >= 89 && !this.activeSignalStrategyId && !potentialSweetSpotId) {
                potentialSweetSpotId = stratId;
            }

            return {
                ...strat,
                confidence: strategySpecificScore,
                score: strategySpecificScore,
                direction: liveDirection
            };
        });

        // 1. Lock in the sweet spot signal immediately when discovered
        if (!this.activeSignalStrategyId && potentialSweetSpotId) {
            this.activeSignalStrategyId = potentialSweetSpotId;
        }

        // 2. Maintain lock as long as confidence stays at or above 85%
        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD) {
                // Securely retain lock as confidence climbs towards 97%
            } else {
                // Drop lock only when confidence cools down below 85%
                this.activeSignalStrategyId = null;
            }
        }

        return [...this.getSortedStrategies()];
    }

    private getSortedStrategies(): Strategy[] {
        if (this.activeSignalStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (index !== -1) {
                const [stickyItem] = copy.splice(index, 1);
                copy.unshift(stickyItem); // Keep active signal pinned securely at the top
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
