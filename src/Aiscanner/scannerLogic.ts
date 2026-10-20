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
    private assetScores: { [symbol: string]: number } = {};
    private assetDirections: { [symbol: string]: 'UP' | 'DOWN' } = {};
    
    private activeSignalSymbol: string | null = null;
    // Hysteresis Fix: Lower disengage threshold to prevent fast 65/80 flickering
    private readonly DISENGAGE_THRESHOLD = 68; 

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
        console.log("[AI Scanner]: Independent Multi-Asset Granular Scoring & Hysteresis Initialized.");
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
        this.assetDirections[symbol] = liveDirection;

        // 1. Track Deeper Directional History (10 ticks for fine fractional percentages)
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

        // 2. Trend Environment Filter (Simple Moving Average of last 20 ticks)
        const sma20 = prices.slice(-20).reduce((acc, val) => acc + val, 0) / 20;
        const distanceToSMA = latestPrice - sma20;
        const isAlignedWithTrend = (distanceToSMA > 0 && liveDirection === 'UP') || (distanceToSMA < 0 && liveDirection === 'DOWN');

        // 3. Graduated Granular Point System (Produces smooth values like 71%, 74%, 78%)
        let calculatedScore = 48; // Healthy baseline starting point

        // A. Magnitude Contribution (Worth up to 20 points)
        const absoluteDelta = Math.abs(netDiff);
        const scaleRef = symbol.includes('100') ? 0.5 : (symbol.includes('50') ? 0.2 : 0.05);
        const magnitudePoints = Math.min(20, (absoluteDelta / scaleRef) * 20);
        calculatedScore += magnitudePoints;

        // B. Granular Confluence Contribution (Worth up to 22 points based on 10-tick ratio)
        const confluencePoints = history.length > 0 ? (sameDirectionCount / history.length) * 22 : 0;
        calculatedScore += confluencePoints;

        // C. Trend Alignment Bonus (Worth up to 15 points)
        if (isAlignedWithTrend) {
            calculatedScore += 15;
        }

        // Clamp final score between 40% and 96%
        const finalStrategyScore = Math.min(96, Math.max(40, Math.round(calculatedScore)));
        
        // Save score specifically for this market symbol
        this.assetScores[symbol] = finalStrategyScore;

        // Update strategies array mapping each card to its respective market score
        this.strategies = this.strategies.map((strat) => {
            const stratSymbol = strat.market || '1HZ50V';
            const marketScore = this.assetScores[stratSymbol] || 50;
            const marketDirection = this.assetDirections[stratSymbol] || 'UP';

            return {
                ...strat,
                confidence: marketScore,
                score: marketScore,
                direction: marketDirection
            };
        });

        // Find overall highest scoring asset across all markets
        let highestCalculatedScore = 0;
        let topSymbol = '';
        for (const [sym, score] of Object.entries(this.assetScores)) {
            if (score > highestCalculatedScore) {
                highestCalculatedScore = score;
                topSymbol = sym;
            }
        }

        // 4. Sticky Signal Management with Hysteresis (Per-Asset)
        if (this.activeSignalSymbol) {
            const activeScore = this.assetScores[this.activeSignalSymbol] || 0;
            if (activeScore < this.DISENGAGE_THRESHOLD) {
                this.activeSignalSymbol = null;
            }
        }

        // 5. Trigger Signal when top market crosses >= 78 cleanly with confluence and trend alignment
        if (!this.activeSignalSymbol && highestCalculatedScore >= 78 && isConfluent && isAlignedWithTrend && topSymbol === symbol) {
            this.activeSignalSymbol = topSymbol;
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        return [...this.strategies].sort((a, b) => {
            const marketA = a.market || '';
            const marketB = b.market || '';
            
            // Prioritize active sticky signal asset if present
            if (marketA === this.activeSignalSymbol) return -1;
            if (marketB === this.activeSignalSymbol) return 1;
            
            return b.confidence - a.confidence;
        });
    }
}
