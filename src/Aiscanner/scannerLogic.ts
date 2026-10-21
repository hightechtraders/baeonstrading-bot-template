// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts (PART 1)
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
    // Dedicated Single Asset Focus Registry targeting Volatility 10 Index exclusively
    private strategies: Strategy[] = INITIAL_STRATEGIES.map(s => ({
        ...s,
        symbol: 'R_10', 
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

    public static readonly SCANNER_MARKETS: string[] = ['R_10'];

    constructor() {
        console.log("[AI Scanner]: High-performance SINGLE-ASSET engine active targeting R_10.");
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
// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts (PART 2)
// ==========================================

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        this.totalTicksReceived++;
        if (!dataParsed || dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }
        // Strict boundary shield: Discard any external market assets to keep calculations clean
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
        // Tightened micro-trend constraint: Requires 4 consecutive identical tick updates
        const isConfluent = dirHistory.length >= 4 && dirHistory.slice(-4).every(d => d === liveDirection);
        const isHighlyConfluent = dirHistory.length >= 6 && dirHistory.slice(-6).every(d => d === liveDirection);

        // Indicator metrics computed entirely from your decoupled Volatility 10 buffer pool
        const rsiShort = this.calculateRSI(prices, 9);
        const rsiMedium = this.calculateRSI(prices, 14);
        const bbp20 = this.calculateBollingerBandsPercent(prices, 20, 2);
        const bbp40 = this.calculateBollingerBandsPercent(prices, 40, 2);
        const emaFast = this.calculateEMA(prices, 9);
        const emaSlow = this.calculateEMA(prices, 21);

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat) => {
            let strategySpecificScore = 50; 
            const stratId = strat.id;

            // =====================================================================
            // TRIPLE CONFLUENCE SIGNAL ENGINE OPTIMIZED SPECIFICALLY FOR R_10 TICKS
            // =====================================================================
            switch (stratId) {
                case '1': // RSI Momentum Spike Reversal 
                    if (rsiMedium < 28 && stratLiveDirection === 'UP' && isConfluent) {
                        strategySpecificScore = 93; 
                    } else if (rsiMedium > 72 && stratLiveDirection === 'DOWN' && isConfluent) {
                        strategySpecificScore = 93; 
                    } else {
                        strategySpecificScore = 50; 
                    }
                    break;

                case '2': // Bollinger Band Squeeze Cross-Back
                    if (bbp20 > 0.02 && bbp20 < 0.12 && stratLiveDirection === 'UP' && isConfluent) {
                        strategySpecificScore = 94;
                    } else if (bbp20 < 0.98 && bbp20 > 0.88 && stratLiveDirection === 'DOWN' && isConfluent) {
                        strategySpecificScore = 94;
                    } else {
                        strategySpecificScore = 50;
                    }
                    break;

                case '3': // EMA Breakout Distance Velocity Expansion
                    const emaDifferencePercentage = (Math.abs(emaFast - emaSlow) / emaSlow) * 100;
                    if (emaFast > emaSlow && stratLiveDirection === 'UP' && isHighlyConfluent && emaDifferencePercentage > 0.03) {
                        strategySpecificScore = Math.round(82 + Math.min(13, emaDifferencePercentage * 280));
                    } else if (emaFast < emaSlow && stratLiveDirection === 'DOWN' && isHighlyConfluent && emaDifferencePercentage > 0.03) {
                        strategySpecificScore = Math.round(82 + Math.min(13, emaDifferencePercentage * 280));
                    } else {
                        strategySpecificScore = 50; 
                    }
                    break;

                case '4': // Micro-Tick Momentum Exhaustion Pattern Tracker
                    strategySpecificScore = isConfluent ? 88 : 50;
                    break;

                case '5': // Bollinger Trend Rider (Uses 40-Period Wide Bands)
                    if (emaFast > emaSlow && bbp40 > 0.60 && stratLiveDirection === 'UP') {
                        strategySpecificScore = 86;
                    } else if (emaFast < emaSlow && bbp40 < 0.40 && stratLiveDirection === 'DOWN') {
                        strategySpecificScore = 86;
                    } else {
                        strategySpecificScore = 50;
                    }
                    break;

                case '6': // TRIPLE CONFLUENCE GOLDEN REVERSAL MASTER SIGNAL
                    const isOversoldReversal = rsiMedium < 30 && bbp20 < 0.08 && stratLiveDirection === 'UP' && isConfluent;
                    const isOverboughtReversal = rsiMedium > 70 && bbp20 > 0.92 && stratLiveDirection === 'DOWN' && isConfluent;

                    if (isOversoldReversal || isOverboughtReversal) {
                        strategySpecificScore = 96; 
                    } else {
                        strategySpecificScore = 50;
                    }
                    break;

                default: // Strategy 7: Dual-RSI Band Confluence Matrix
                    if (rsiShort < 25 && rsiMedium < 30 && stratLiveDirection === 'UP' && isConfluent) {
                        strategySpecificScore = 95;
                    } else if (rsiShort > 75 && rsiMedium > 70 && stratLiveDirection === 'DOWN' && isConfluent) {
                        strategySpecificScore = 95;
                    } else {
                        strategySpecificScore = 50;
                    }
                    break;
            }

            // High-Conviction Accelerator: Add booster only to cards that cleared entry thresholds
            if (isConfluent && strategySpecificScore >= 88) {
                strategySpecificScore += 3;
            }

            strategySpecificScore = Math.min(97, Math.max(42, strategySpecificScore));

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

        // Time-Locked Layout Stabilization Routine
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
