// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts
// Real Quantitative Engine for Live Micro Trading
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
        confidence: 50,
        score: 50
    }));

    // Isolated buffers per specific asset/symbol
    private priceBuffers: { [symbol: string]: number[] } = {};
    
    private lockedUntil: number = 0;
    private lockedStrategyId: string | null = null;
    private readonly LOCK_DURATION_MS = 10000; // Expanded to 10s for safe manual execution review

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
        console.log("[AI Scanner]: Production-grade quantitative calculation engine initialized for live execution.");
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
        // Maintain a rolling window of the last 50 ticks for deep math calculations
        if (this.priceBuffers[symbol].length > 50) {
            this.priceBuffers[symbol].shift();
        }

        // If locked on a high-conviction signal, keep order stable so you can load it to workspace
        if (now < this.lockedUntil && this.lockedStrategyId) {
            return this.getSortedStrategies();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 10) {
            // Lowered minimum buffer slightly to ensure fast UI initialization without long blank waits
            return this.getSortedStrategies();
        }

        // --- REAL MATHEMATICAL INDICATORS ---
        const liveDirection = this.calculateLiveDirection(prices);
        const volatilityFactor = this.calculateStandardDeviation(prices);
        
        // 1. Volatility Gate: If market is entirely flat/dead (chop), suppress high scores
        const isMarketChoppy = volatilityFactor < 0.0002; 

        let triggeredHighConfidence = false;
        let targetStrategyId = '';

        // 2. Evaluate each strategy using true independent indicator logic
        this.strategies = this.strategies.map((strat) => {
            // Only update strategies matching this incoming symbol feed (or allow fallback if symbol isn't strictly defined)
            if (strat.symbol && strat.symbol !== symbol) {
                return strat;
            }

            let calculatedScore = 50;
            let stratDirection = liveDirection;

            if (isMarketChoppy) {
                return {
                    ...strat,
                    confidence: 45,
                    score: 45,
                    direction: liveDirection
                };
            }

            switch (strat.id) {
                case '1': // RSI Momentum Spike
                    calculatedScore = this.evaluateRsiMomentum(prices);
                    break;
                case '2': // Bollinger Band / Volatility Expansion Breakout
                    calculatedScore = this.evaluateVolatilityBreakout(prices);
                    break;
                case '3': // EMA Crossover
                    {
                        const emaResult = this.evaluateEmaCrossover(prices);
                        calculatedScore = emaResult.score;
                        stratDirection = emaResult.direction;
                    }
                    break;
                case '4': // Tick Reversal Pattern
                    calculatedScore = this.evaluateReversalPattern(prices);
                    break;
                case '5': // MACD Histogram Momentum Surge
                    calculatedScore = this.evaluateMacdSurge(prices);
                    break;
                case '6': // Support/Resistance Local Bounce
                    calculatedScore = this.evaluateSupportResistanceBounce(prices);
                    break;
                case '7': // High-Frequency Multi-Tick Scalper
                    calculatedScore = this.evaluateHfScalper(prices);
                    break;
                default:
                    calculatedScore = 65;
            }

            const finalScore = Math.round(Math.min(98, Math.max(40, calculatedScore)));

            if (finalScore >= 86 && !triggeredHighConfidence) {
                triggeredHighConfidence = true;
                targetStrategyId = strat.id;
            }

            return {
                ...strat,
                confidence: finalScore,
                score: finalScore,
                direction: stratDirection
            };
        });

        if (triggeredHighConfidence && targetStrategyId) {
            this.lockedUntil = now + this.LOCK_DURATION_MS;
            this.lockedStrategyId = targetStrategyId;
        }

        return this.getSortedStrategies();
    }

    // --- MATHEMATICAL HELPER METHODS ---

    private calculateLiveDirection(prices: number[]): 'UP' | 'DOWN' {
        const latest = prices[prices.length - 1];
        const prev = prices[prices.length - 2];
        return latest >= prev ? 'UP' : 'DOWN';
    }

    private calculateStandardDeviation(prices: number[]): number {
        const n = prices.length;
        const mean = prices.reduce((sum, p) => sum + p, 0) / n;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / n;
        return Math.sqrt(variance);
    }

    private evaluateRsiMomentum(prices: number[]): number {
        let gains = 0;
        let losses = 0;
        const period = Math.min(14, prices.length - 1);

        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses += Math.abs(diff);
        }

        if (losses === 0) return 92;
        const rs = gains / losses;
        const rsi = 100 - (100 / (1 + rs));

        if (rsi > 70 || rsi < 30) return 89;
        if (rsi > 60 || rsi < 40) return 78;
        return 62;
    }

    private evaluateVolatilityBreakout(prices: number[]): number {
        const recentSlice = prices.slice(-10);
        const stdDev = this.calculateStandardDeviation(recentSlice);
        const mean = recentSlice.reduce((a, b) => a + b, 0) / recentSlice.length;
        const currentPrice = prices[prices.length - 1];

        const zScore = Math.abs(currentPrice - mean) / (stdDev || 0.0001);
        if (zScore > 2.0) return 91;
        if (zScore > 1.5) return 82;
        return 60;
    }

    private evaluateEmaCrossover(prices: number[]): { score: number; direction: 'UP' | 'DOWN' } {
        const fastEma = this.calculateEMA(prices, 3);
        const slowEma = this.calculateEMA(prices, 10);
        
        const diff = fastEma - slowEma;
        const direction: 'UP' | 'DOWN' = diff >= 0 ? 'UP' : 'DOWN';
        const magnitude = Math.abs(diff);

        let score = 65;
        if (magnitude > 0.05) score = 88;
        else if (magnitude > 0.02) score = 76;

        return { score, direction };
    }

    private calculateEMA(prices: number[], period: number): number {
        const k = 2 / (period + 1);
        let ema = prices[prices.length - period];
        for (let i = prices.length - period + 1; i < prices.length; i++) {
            ema = (prices[i] * k) + (ema * (1 - k));
        }
        return ema;
    }

    private evaluateReversalPattern(prices: number[]): number {
        const t3 = prices[prices.length - 1];
        const t2 = prices[prices.length - 2];
        const t1 = prices[prices.length - 3];

        const isVee = t2 < t1 && t2 < t3; 
        const isPeak = t2 > t1 && t2 > t3; 

        if (isVee || isPeak) return 85;
        return 65;
    }

    private evaluateMacdSurge(prices: number[]): number {
        const fastEma = this.calculateEMA(prices, 5);
        const slowEma = this.calculateEMA(prices, 12);
        const macdLine = fastEma - slowEma;
        
        const score = 60 + Math.min(30, Math.abs(macdLine) * 1500);
        return Math.round(score);
    }

    private evaluateSupportResistanceBounce(prices: number[]): number {
        const recent = prices.slice(-20);
        const min = Math.min(...recent);
        const max = Math.max(...recent);
        const current = prices[prices.length - 1];

        const distToMin = Math.abs(current - min);
        const distToMax = Math.abs(current - max);

        if (distToMin < 0.01 || distToMax < 0.01) return 87;
        return 68;
    }

    private evaluateHfScalper(prices: number[]): number {
        const t3 = prices[prices.length - 1];
        const t2 = prices[prices.length - 2];
        const t1 = prices[prices.length - 3];
        const t0 = prices[prices.length - 4];

        if (t3 > t2 && t2 > t1 && t1 > t0) return 93; 
        if (t3 < t2 && t2 < t1 && t1 < t0) return 93; 
        return 60;
    }

    private getSortedStrategies(): Strategy[] {
        if (Date.now() < this.lockedUntil && this.lockedStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => s.id === this.lockedStrategyId);
            if (index > 0) {
                const [lockedItem] = copy.splice(index, 1);
                copy.unshift(lockedItem);
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
