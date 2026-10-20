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
    // Maps your strategy array utilizing .symbol cleanly to prevent fallback freezes
    private strategies: Strategy[] = INITIAL_STRATEGIES.map(s => ({
        ...s,
        name: s.name || 'Volatility AI Scalper',
        symbol: s.symbol || '1HZ50V', 
        confidence: s.confidence || 50
    }));

    private priceBuffers: { [symbol: string]: number[] } = {};
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
    
    // Time-locked hysteresis states to balance visualization readability
    private activeSignalStrategyId: string | null = null;
    private signalLockExpiryEpoch: number = 0; 
    private readonly MIN_LOCK_DURATION_TICKS = 5; 
    private readonly DISENGAGE_THRESHOLD = 82; 
    private totalTicksReceived = 0;

    public static readonly SCANNER_MARKETS: string[] = [
        '1HZ50V', '1HZ75V', '1HZ10V', '1HZ100V', 'R_25', 'R_75', 'R_10'
    ];

    constructor() {
        console.log("[AI Scanner]: Mathematical indicators & persistent filter engine online.");
    }

    // Helper: Exponential Moving Average (EMA)
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

    // Helper: Relative Strength Index (RSI)
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

    // Helper: Bollinger Bands Percent B (%B)
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
        if (this.totalTicksReceived % 20 === 0 && dataParsed?.tick) {
            console.log(`[WebSocket Stream]: Ingesting ${dataParsed.tick.symbol} | Quote: ${dataParsed.tick.quote}`);
        }
        if (!dataParsed || dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }
        return this.processLiveTick(dataParsed.tick.symbol, Number(dataParsed.tick.quote));
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!this.priceBuffers[symbol]) this.priceBuffers[symbol] = [];
        this.priceBuffers[symbol].push(price);
        if (this.priceBuffers[symbol].length > 100) this.priceBuffers[symbol].shift();

        const currentPrices = this.priceBuffers[symbol];
        const latestPrice = currentPrices[currentPrices.length - 1];
        const prevPrice = currentPrices.length > 1 ? currentPrices[currentPrices.length - 2] : latestPrice;
        const liveDirection: 'UP' | 'DOWN' = (latestPrice - prevPrice) >= 0 ? 'UP' : 'DOWN';

        if (!this.directionHistory[symbol]) this.directionHistory[symbol] = [];
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 5) this.directionHistory[symbol].shift();

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat) => {
            const targetSymbol = strat.symbol || '1HZ50V';
            
            if (!this.priceBuffers[targetSymbol] || this.priceBuffers[targetSymbol].length === 0) {
                this.priceBuffers[targetSymbol] = [price];
            }
            if (!this.directionHistory[targetSymbol] || this.directionHistory[targetSymbol].length === 0) {
                this.directionHistory[targetSymbol] = [liveDirection];
            }

            const prices = this.priceBuffers[targetSymbol];
            const stratDirHistory = this.directionHistory[targetSymbol];
            const stratLiveDirection = stratDirHistory[stratDirHistory.length - 1];
            const isConfluent = stratDirHistory.length >= 3 && stratDirHistory.slice(-3).every(d => d === stratLiveDirection);

            const rsi14 = this.calculateRSI(prices, 14);
            const bbp20 = this.calculateBollingerBandsPercent(prices, 20, 2);
            const emaFast = this.calculateEMA(prices, 9);
            const emaSlow = this.calculateEMA(prices, 21);

            let strategySpecificScore = 50; 
            const stratId = strat.id;

            switch (stratId) {
                case '1': // RSI Momentum Spike
                    if (rsi14 < 30 && stratLiveDirection === 'UP') strategySpecificScore = 88;
                    else if (rsi14 > 70 && stratLiveDirection === 'DOWN') strategySpecificScore = 88;
                    else strategySpecificScore = Math.round(50 - Math.abs(50 - rsi14));
                    break;

                case '2': // Bollinger Band Squeeze (Dynamic Gradient Scaling)
                    if (bbp20 < 0.10 && stratLiveDirection === 'UP') {
                        strategySpecificScore = Math.round(80 + ((0.10 - bbp20) * 100)); 
                    } else if (bbp20 > 0.90 && stratLiveDirection === 'DOWN') {
                        strategySpecificScore = Math.round(80 + ((bbp20 - 0.90) * 100));
                    } else {
                        strategySpecificScore = 55;
                    }
                    break;

                case '3': // EMA Crossover Breakout (Proportional Moving Gradient)
                    const emaDifferencePercentage = (Math.abs(emaFast - emaSlow) / emaSlow) * 100;
                    if (emaFast > emaSlow && stratLiveDirection === 'UP') {
                        strategySpecificScore = Math.round(78 + Math.min(12, emaDifferencePercentage * 150));
                    } else if (emaFast < emaSlow && stratLiveDirection === 'DOWN') {
                        strategySpecificScore = Math.round(78 + Math.min(12, emaDifferencePercentage * 150));
                    } else {
                        strategySpecificScore = 48; 
                    }
                    break;

                case '4': // Tick Reversal Pattern
                case '6': // Support/Resistance Bounce
                    strategySpecificScore = isConfluent ? 84 : 52;
                    break;

                default: // Catch-all for Digit and MACD layouts
                    const trendAligns = (emaFast > emaSlow && stratLiveDirection === 'UP') || (emaFast < emaSlow && stratLiveDirection === 'DOWN');
                    strategySpecificScore = (trendAligns && isConfluent) ? 83 : 60;
                    break;
            }

            if (isConfluent && strategySpecificScore >= 70) {
                strategySpecificScore += 6;
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
                direction: stratLiveDirection
            };
        });

        // Time-Locked Pinning Routine
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

        const topStrat = this.strategies.find(s => s.id === topStrategyId);
        const topSymbol = topStrat?.symbol || '1HZ50V';
        const topHistory = this.directionHistory[topSymbol] || [];
        const topConfluent = topHistory.length >= 3 && topHistory.slice(-3).every(d => d === topHistory[topHistory.length - 1]);

        if (!this.activeSignalStrategyId && highestCalculatedScore >= 89 && topConfluent && topStrategyId) {
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
