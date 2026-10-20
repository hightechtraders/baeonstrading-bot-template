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
        console.log("[AI Scanner]: Graduated Weighted Scoring & Live UI Filter Initialized.");
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
        
        // Keep a healthy buffer size for moving average calculations (last 30 ticks)
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
        const sameDirectionCount = history.filter(d => d === liveDirection).length;
        const isConfluent = history.length >= 3 && history.slice(-3).every(d => d === liveDirection);

        // 2. Trend Environment Filter (Simple Moving Average of last 20 ticks)
        const sma20 = prices.slice(-20).reduce((acc, val) => acc + val, 0) / 20;
        const distanceToSMA = latestPrice - sma20;
        const isAlignedWithTrend = (distanceToSMA > 0 && liveDirection === 'UP') || (distanceToSMA < 0 && liveDirection === 'DOWN');

        // 3. Graduated Weighted Point System (Replaces binary flatlining with live breathing UI numbers)
        let calculatedScore = 45; // Healthy baseline starting point

        // A. Magnitude Contribution (Worth up to 20 points)
        const absoluteDelta = Math.abs(netDiff);
        const scaleRef = symbol.includes('100') ? 0.5 : (symbol.includes('50') ? 0.2 : 0.05);
        const magnitudePoints = Math.min(20, (absoluteDelta / scaleRef) * 20);
        calculatedScore += magnitudePoints;

        // B. Confluence Contribution (Worth up to 20 points based on recent streak)
        const confluencePoints = history.length > 0 ? (sameDirectionCount / history.length) * 20 : 0;
        calculatedScore += confluencePoints;

        // C. Trend Alignment Bonus (Worth up to 15 points)
        if (isAlignedWithTrend) {
            calculatedScore += 15;
        }

        // Clamp final score between 40% and 96%
        const finalStrategyScore = Math.min(96, Math.max(40, Math.round(calculatedScore)));

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat, index) => {
            const spreadOffset = (index === 0) ? 0 : (index * 3);
            let strategyScore = Math.min(96, Math.max(40, finalStrategyScore - spreadOffset));

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

        // 5. Trigger Signal when accumulated score crosses >= 85 with strong confluence & trend alignment
        if (!this.activeSignalStrategyId && highestCalculatedScore >= 85 && isConfluent && isAlignedWithTrend && topStrategyId) {
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
