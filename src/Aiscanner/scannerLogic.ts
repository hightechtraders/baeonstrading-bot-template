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
    // Force all dashboard cards to focus on your single target asset
    private strategies: Strategy[] = INITIAL_STRATEGIES.map(s => ({
        ...s,
        symbol: 'R_10', // Dedicated Single Asset Focus (Volatility 10 Index)
        market: 'Volatility 10 Index',
        confidence: s.confidence || 50
    }));

    private priceBuffers: { [symbol: string]: number[] } = {};
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
    
    private activeSignalStrategyId: string | null = null;
    private signalLockExpiryEpoch: number = 0; 
    private readonly MIN_LOCK_DURATION_TICKS = 5; 
    private readonly DISENGAGE_THRESHOLD = 84; 
    private totalTicksReceived = 0;

    constructor() {
        console.log("[AI Scanner]: High-performance SINGLE-ASSET engine active.");
    }

    private calculateEMA(prices: number[], period: number): number {
        if (prices.length === 0) return 0;
        if (prices.length < period) return prices[prices.length - 1];
        const k = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    }

    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length <= period) return 50;
        let gains = 0, losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff > 0) gains += diff; else losses += Math.abs(diff);
        }
        if (losses === 0) return 100;
        return 100 - (100 / (1 + (gains / losses)));
    }

    private calculateBollingerBandsPercent(prices: number[], period: number = 20, multiplier: number = 2): number {
        if (prices.length < period) return 0.5;
        const slice = prices.slice(-period);
        const mean = slice.reduce((sum, val) => sum + val, 0) / period;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const upperBand = mean + (multiplier * stdDev);
        const lowerBand = mean - (multiplier * stdDev);
        if (upperBand === lowerBand) return 0.5;
        return (prices[prices.length - 1] - lowerBand) / (upperBand - lowerBand);
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        this.totalTicksReceived++;
        if (!dataParsed || dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }
        // ONLY accept data if it belongs to our target asset to block residual noise
        if (dataParsed.tick.symbol !== 'R_10') return this.getSortedStrategies();

        return this.processLiveTick(dataParsed.tick.symbol, Number(dataParsed.tick.quote));
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!this.priceBuffers[symbol]) this.priceBuffers[symbol] = [];
        this.priceBuffers[symbol].push(price);
        if (this.priceBuffers[symbol].length > 150) this.priceBuffers[symbol].shift();

        const prices = this.priceBuffers[symbol];
        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices.length > 1 ? prices[prices.length - 2] : latestPrice;
        const liveDirection: 'UP' | 'DOWN' = (latestPrice - prevPrice) >= 0 ? 'UP' : 'DOWN';

        if (!this.directionHistory[symbol]) this.directionHistory[symbol] = [];
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 8) this.directionHistory[symbol].shift();

        const dirHistory = this.directionHistory[symbol];
        const isConfluent = dirHistory.length >= 3 && dirHistory.slice(-3).every(d => d === liveDirection);
        const isHighlyConfluent = dirHistory.length >= 5 && dirHistory.slice(-5).every(d => d === liveDirection);

        // Core Mathematical Indicators Calculated From the Same Asset Feed
        const rsiShort = this.calculateRSI(prices, 9);
        const rsiMedium = this.calculateRSI(prices, 14);
        const bbp20 = this.calculateBollingerBandsPercent(prices, 20, 2);
        const bbp40 = this.calculateBollingerBandsPercent(prices, 40, 2);
        const emaFast = this.calculateEMA(prices, 9);
        const emaSlow = this.calculateEMA(prices, 21);

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat) => {
            let score = 50; 
            const stratId = strat.id;

            // 7 Highly Filtered Strategy Implementations Built for One Continuous Stream
            switch (stratId) {
                case '1': // Strategy 1: RSI Over-Extended Spike Reversal
                    if (rsiMedium < 22 && isConfluent && liveDirection === 'UP') score = 94;
                    else if (rsiMedium > 78 && isConfluent && liveDirection === 'DOWN') score = 94;
                    break;

                case '2': // Strategy 2: Bollinger Band Extreme Reversion
                    if (bbp20 < 0.02 && liveDirection === 'UP' && isConfluent) score = 92;
                    else if (bbp20 > 0.98 && liveDirection === 'DOWN' && isConfluent) score = 92;
                    break;

                case '3': // Strategy 3: Fast Momentum Scalper
                    const emaDiff = (Math.abs(emaFast - emaSlow) / emaSlow) * 100;
                    if (emaFast > emaSlow && liveDirection === 'UP' && isHighlyConfluent) {
                        score = Math.round(84 + Math.min(11, emaDiff * 400));
                    } else if (emaFast < emaSlow && liveDirection === 'DOWN' && isHighlyConfluent) {
                        score = Math.round(84 + Math.min(11, emaDiff * 400));
                    }
                    break;

                case '4': // Strategy 4: High-Velocity Tick Reversal
                    if (isHighlyConfluent) score = 89;
                    break;

                case '5': // Strategy 5: Macro Trend Rider (Uses Extended 40-Period Volatility Bands)
                    if (emaFast > emaSlow && bbp40 > 0.60 && liveDirection === 'UP') score = 86;
                    else if (emaFast < emaSlow && bbp40 < 0.40 && liveDirection === 'DOWN') score = 86;
                    break;

                case '6': // Strategy 6: Support/Resistance Bounce Check
                    if (rsiShort < 30 && bbp20 < 0.10 && liveDirection === 'UP') score = 91;
                    else if (rsiShort > 70 && bbp20 > 0.90 && liveDirection === 'DOWN') score = 91;
                    break;

                default: // Strategy 7: Dual-RSI Confluence Matrix
                    if (rsiShort < 25 && rsiMedium < 30 && liveDirection === 'UP') score = 93;
                    else if (rsiShort > 75 && rsiMedium > 70 && liveDirection === 'DOWN') score = 93;
                    break;
            }

            score = Math.min(97, Math.max(45, score));

            if (score > highestCalculatedScore) {
                highestCalculatedScore = score;
                topStrategyId = stratId;
            }

            return {
                ...strat,
                confidence: score,
                score: score,
                direction: liveDirection
            };
        });

        // Time-Locked Layout Window updates
        const currentEpoch = Math.floor(Date.now() / 1000);

        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => s.id === this.activeSignalStrategyId);
            const timeWindowExpired = currentEpoch >= this.signalLockExpiryEpoch;

            if (currentActiveStrat) {
                if (currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD && !timeWindowExpired) {
                    return this.getSortedStrategies();
                } else {
                    this.activeSignalStrategyId = null;
                }
            }
        }

        if (!this.activeSignalStrategyId && highestCalculatedScore >= 90 && isConfluent && topStrategyId) {
            this.activeSignalStrategyId = topStrategyId;
            this.signalLockExpiryEpoch = currentEpoch + this.MIN_LOCK_DURATION_TICKS;
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        if (this.activeSignalStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => s.id === this.activeSignalStrategyId);
            if (index > 0) {
                const [stickyItem] = copy.splice(index, 1);
                copy.unshift(stickyItem);
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
