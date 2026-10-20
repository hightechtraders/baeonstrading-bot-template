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

    // Expanded historical buffer memory size to provide safe mathematical windows for TA
    private priceBuffers: { [symbol: string]: number[] } = {};
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
    
    private activeSignalStrategyId: string | null = null;
    private readonly DISENGAGE_THRESHOLD = 82; 

    public static readonly SCANNER_MARKETS: string[] = [
        '1HZ50V', '1HZ75V', '1HZ10V', '1HZ100V', 'R_25', 'R_75', 'R_10'
    ];

    constructor() {
        console.log("[AI Scanner]: Mathematical indicators & persistent filter engine online.");
    }

    // Helper: Exponential Moving Average
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

    // Helper: Relative Strength Index
    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length <= period) return 50;
        let gains = 0;
        let losses = 0;
        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff > 0) gains += diff;
            else losses += Math.abs(diff);
        }
        if (losses === 0) return 100;
        const rs = gains / losses;
        return 100 - (100 / (1 + rs));
    }

    // Helper: Bollinger Bands Percent B (%B)
    private calculateBollingerBandsPercent(prices: number[], period: number = 20, multiplier: number = 2): number {
        if (prices.length < period) return 0.5; // Default to absolute center (50%)
        const slice = prices.slice(-period);
        const mean = slice.reduce((sum, val) => sum + val, 0) / period;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        const upperBand = mean + (multiplier * stdDev);
        const lowerBand = mean - (multiplier * stdDev);
        const latestPrice = prices[prices.length - 1];

        if (upperBand === lowerBand) return 0.5;
        return (latestPrice - lowerBand) / (upperBand - lowerBand);
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
        
        // Extended memory ceiling to 100 entries to give indicators proper mathematical context
        if (this.priceBuffers[symbol].length > 100) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices.length > 1 ? prices[prices.length - 2] : latestPrice;
        const liveDirection: 'UP' | 'DOWN' = (latestPrice - prevPrice) >= 0 ? 'UP' : 'DOWN';

        if (!this.directionHistory[symbol]) {
            this.directionHistory[symbol] = [];
        }
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 5) {
            this.directionHistory[symbol].shift();
        }

        const history = this.directionHistory[symbol];
        const isConfluent = history.length >= 3 && history.slice(-3).every(d => d === liveDirection);

        // Compute verified market metrics across asset windows
        const rsi14 = this.calculateRSI(prices, 14);
        const bbp20 = this.calculateBollingerBandsPercent(prices, 20, 2);
        const emaFast = this.calculateEMA(prices, 9);
        const emaSlow = this.calculateEMA(prices, 21);

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat) => {
            // Only measure strategies calibrated for the specific incoming ticker feed
            if (strat.market !== symbol) {
                return strat;
            }

            let strategySpecificScore = 50; // Balanced Neutral Starting Line
            const stratId = strat.id || strat.name;

            // Route strategic signatures based on explicit mathematical features
            switch (stratId) {
                case 'RSI_SCALPER':
                case 'RSI_OVERSOLD_SCALPER':
                    if (rsi14 < 30 && liveDirection === 'UP') strategySpecificScore = 88;
                    else if (rsi14 > 70 && liveDirection === 'DOWN') strategySpecificScore = 88;
                    else strategySpecificScore = 50 - Math.abs(50 - rsi14);
                    break;

                case 'EMA_CROSSOVER':
                case 'EMA_TREND_CROSS':
                    if (emaFast > emaSlow && liveDirection === 'UP') strategySpecificScore = 86;
                    else if (emaFast < emaSlow && liveDirection === 'DOWN') strategySpecificScore = 86;
                    else strategySpecificScore = 45;
                    break;

                case 'BOLLINGER_REVERSION':
                case 'BB_PERCENT_SCALPER':
                    if (bbp20 < 0.05 && liveDirection === 'UP') strategySpecificScore = 90;
                    else if (bbp20 > 0.95 && liveDirection === 'DOWN') strategySpecificScore = 90;
                    else strategySpecificScore = 60;
                    break;

                default:
                    // Confluence Multi-Indicator Fallback
                    const trendAligns = (emaFast > emaSlow && liveDirection === 'UP') || (emaFast < emaSlow && liveDirection === 'DOWN');
                    if (trendAligns && isConfluent) strategySpecificScore = 82;
                    else strategySpecificScore = 55;
                    break;
            }

            // Inject a minor performance booster if multi-tick momentum directional confluence is active
            if (isConfluent && strategySpecificScore >= 70) {
                strategySpecificScore += 7;
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

        // Sticky Signal Persistence Routine
        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD && isConfluent) {
                return this.getSortedStrategies();
            } else {
                this.activeSignalStrategyId = null;
            }
        }

        // Lock in a fresh signal entry condition when confirmation clears threshold requirements
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
