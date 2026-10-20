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
    private strategies: Strategy[] = INITIAL_STRATEGIES.map(s => ({
        ...s,
        name: s.name && s.name !== 'Connecting to Live Deriv Feed...' ? s.name : 'Volatility 50 AI Scalper',
        market: s.market || '1HZ50V',
        confidence: s.confidence || 78
    }));

    // Isolated buffers tracking market price history and directions
    private priceBuffers: { [symbol: string]: number[] } = {};
    private directionHistory: { [symbol: string]: ('UP' | 'DOWN')[] } = {};
    
    // Sticky Persistence state tracking
    private activeSignalStrategyId: string | null = null;
    private readonly DISENGAGE_THRESHOLD = 82; 
    
    // Internal performance debugging hit tracker
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
// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts (PART 2)
// ==========================================

    /**
     * Entry Router for your custom third-party WebSocket subscriber interface
     */
    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        this.totalTicksReceived++;

        // WebSocket Diagnostic: Logs every 20th tick packet to verify active socket streams
        if (this.totalTicksReceived % 20 === 0) {
            console.log(`[WebSocket Hit #${this.totalTicksReceived}]: msg_type="${dataParsed?.msg_type}"`);
            if (dataParsed?.tick) {
                console.log(` -> Data: Market=${dataParsed.tick.symbol} | Quote=${dataParsed.tick.quote}`);
            }
        }

        if (!dataParsed || dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    /**
     * Core Algorithm Processor
     */
    public processLiveTick(symbol: string, price: number): Strategy[] {
        // 1. Safe ingestion into asset-specific price buffer memory arrays
        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        
        if (this.priceBuffers[symbol].length > 100) {
            this.priceBuffers[symbol].shift();
        }

        const currentPrices = this.priceBuffers[symbol];
        const latestPrice = currentPrices[currentPrices.length - 1];
        const prevPrice = currentPrices.length > 1 ? currentPrices[currentPrices.length - 2] : latestPrice;
        const liveDirection: 'UP' | 'DOWN' = (latestPrice - prevPrice) >= 0 ? 'UP' : 'DOWN';

        // Update direction history arrays explicitly for the active ticker stream
        if (!this.directionHistory[symbol]) {
            this.directionHistory[symbol] = [];
        }
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 5) {
            this.directionHistory[symbol].shift();
        }

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        // 2. Loop across ALL pipeline strategies unconditionally to prevent UI freezing
        this.strategies = this.strategies.map((strat) => {
            const stratMarket = strat.market || '1HZ50V';
            
            // Seed cold/empty cross-asset buffers with current market values to prevent crash scenarios
            if (!this.priceBuffers[stratMarket] || this.priceBuffers[stratMarket].length === 0) {
                this.priceBuffers[stratMarket] = [price];
            }
            if (!this.directionHistory[stratMarket] || this.directionHistory[stratMarket].length === 0) {
                this.directionHistory[stratMarket] = [liveDirection];
            }

            const prices = this.priceBuffers[stratMarket];
            const stratDirHistory = this.directionHistory[stratMarket];
            const stratLiveDirection = stratDirHistory[stratDirHistory.length - 1];
            const isConfluent = stratDirHistory.length >= 3 && stratDirHistory.slice(-3).every(d => d === stratLiveDirection);

            // Compute unique indicator states across the specific strategy's target market context
            const rsi14 = this.calculateRSI(prices, 14);
            const bbp20 = this.calculateBollingerBandsPercent(prices, 20, 2);
            const emaFast = this.calculateEMA(prices, 9);
            const emaSlow = this.calculateEMA(prices, 21);

            let strategySpecificScore = 50; 
            const stratId = strat.id || strat.name;

            // Compute mathematical trade rules mapped cleanly against indicator thresholds
            switch (stratId) {
                case 'RSI_SCALPER':
                case 'RSI_OVERSOLD_SCALPER':
                    if (rsi14 < 30 && stratLiveDirection === 'UP') strategySpecificScore = 88;
                    else if (rsi14 > 70 && stratLiveDirection === 'DOWN') strategySpecificScore = 88;
                    else strategySpecificScore = 50 - Math.abs(50 - rsi14);
                    break;

                case 'EMA_CROSSOVER':
                case 'EMA_TREND_CROSS':
                    if (emaFast > emaSlow && stratLiveDirection === 'UP') strategySpecificScore = 86;
                    else if (emaFast < emaSlow && stratLiveDirection === 'DOWN') strategySpecificScore = 86;
                    else strategySpecificScore = 45;
                    break;

                case 'BOLLINGER_REVERSION':
                case 'BB_PERCENT_SCALPER':
                    if (bbp20 < 0.05 && stratLiveDirection === 'UP') strategySpecificScore = 90;
                    else if (bbp20 > 0.95 && stratLiveDirection === 'DOWN') strategySpecificScore = 90;
                    else strategySpecificScore = 60;
                    break;

                default:
                    const trendAligns = (emaFast > emaSlow && stratLiveDirection === 'UP') || (emaFast < emaSlow && stratLiveDirection === 'DOWN');
                    if (trendAligns && isConfluent) strategySpecificScore = 82;
                    else strategySpecificScore = 55;
                    break;
            }

            // Apply a multi-tick velocity confidence bonus if immediate micro-trend matches directional bias
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
                direction: stratLiveDirection
            };
        });

        // 3. Sticky Signals Rule: Enforce state preservation windows
        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            const activeMarket = currentActiveStrat?.market || '1HZ50V';
            const activeHistory = this.directionHistory[activeMarket] || [];
            const activeConfluent = activeHistory.length >= 3 && activeHistory.slice(-3).every(d => d === activeHistory[activeHistory.length - 1]);

            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD && activeConfluent) {
                return this.getSortedStrategies();
            } else {
                this.activeSignalStrategyId = null;
            }
        }

        // Lock in a fresh execution target if confirmation thresholds clear our requirements
        const topStrat = this.strategies.find(s => (s.id || s.name) === topStrategyId);
        const topMarket = topStrat?.market || '1HZ50V';
        const topHistory = this.directionHistory[topMarket] || [];
        const topConfluent = topHistory.length >= 3 && topHistory.slice(-3).every(d => d === topHistory[topHistory.length - 1]);

        if (!this.activeSignalStrategyId && highestCalculatedScore >= 89 && topConfluent && topStrategyId) {
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
