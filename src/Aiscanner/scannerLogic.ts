// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts (Multi-Volatility Indicator-Driven Alpha Engine)
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
    public static readonly SCANNER_MARKETS: string[] = [
        'R_10',
        '1HZ10V',
        'R_25',
        '1HZ25V',
        'R_50',
        '1HZ50V',
        'R_75',
        '1HZ75V',
        'R_100',
        '1HZ100V',
    ];

    private strategies: Strategy[] = INITIAL_STRATEGIES.map(s => ({
        ...s,
        name: s.name && s.name !== 'Connecting to Live Deriv Feed...' ? s.name : `${s.market || 'R_10'} Alpha Engine`,
        market: s.market || s.symbol || 'R_10',
        symbol: s.symbol || s.market || 'R_10',
        confidence: s.confidence || 50,
        score: s.score || s.confidence || 50,
    }));

    private priceBuffers: { [symbol: string]: number[] } = {};

    // Entry Stabilization Tracking per symbol
    private consecutiveSweetSpotTicks: { [symbol: string]: number } = {};
    private readonly REQUIRED_STABILIZATION_TICKS = 3;

    // Sticky persistence state
    private activeSignalStrategyId: string | null = null;
    private readonly DISENGAGE_THRESHOLD = 82;

    // ==========================================
    // COOLDOWN & BURST RUN CAP STATE
    // ==========================================
    private consecutiveLosses: number = 0;
    private readonly MAX_CONSECUTIVE_LOSSES = 2;
    private cooldownTicksRemaining: number = 0;
    private readonly COOLDOWN_DURATION_TICKS = 15;

    private activeRunCount: number = 0;
    private readonly MAX_BURST_RUNS = 3;
    private isBurstActive: boolean = false;

    constructor() {
        console.log(
            `[AI Scanner]: Technical Indicator Engine (RSI, EMA, Bollinger %B) active across ${ScannerLogic.SCANNER_MARKETS.length} Volatility Indices.`
        );
    }

    public recordTradeOutcome(isWin: boolean) {
        if (isWin) {
            this.consecutiveLosses = 0;
            this.activeRunCount++;
            console.log(`✅ Trade won. Burst progress: ${this.activeRunCount}/${this.MAX_BURST_RUNS}`);

            if (this.activeRunCount >= this.MAX_BURST_RUNS) {
                console.log(`🎯 Burst limit reached (${this.MAX_BURST_RUNS} runs). Pausing to reassess clean trend.`);
                this.triggerCooldown('🎯 Burst target reached: Pausing to review market stability.');
            }
        } else {
            this.consecutiveLosses += 1;
            console.warn(`⚠️ Trade lost. Consecutive losses: ${this.consecutiveLosses}/${this.MAX_CONSECUTIVE_LOSSES}`);

            if (this.consecutiveLosses >= this.MAX_CONSECUTIVE_LOSSES) {
                this.triggerCooldown(`🛡️ Circuit Breaker: Paused after ${this.consecutiveLosses} losses. Waiting out chop.`);
                this.consecutiveLosses = 0;
            }
        }
    }

    private triggerCooldown(message: string) {
        this.cooldownTicksRemaining = this.COOLDOWN_DURATION_TICKS;
        this.activeSignalStrategyId = null;
        this.activeRunCount = 0;
        this.isBurstActive = false;

        if (typeof document !== 'undefined') {
            const stopBtn = Array.from(document.querySelectorAll('button')).find(
                b => b.textContent?.trim() === 'Stop'
            );
            if (stopBtn instanceof HTMLElement) {
                stopBtn.click();
            }
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(
                new CustomEvent('ai-circuit-breaker-triggered', {
                    detail: { message },
                })
            );
        }
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (!dataParsed || dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }
        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    // ==========================================
    // TECHNICAL INDICATOR CALCULATIONS
    // ==========================================
    private calculateEMA(prices: number[], period: number): number {
        if (prices.length === 0) return 0;
        const k = 2 / (period + 1);
        let ema = prices[0];
        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }
        return ema;
    }

    private calculateRSI(prices: number[], period: number = 14): number {
        if (prices.length < period + 1) return 50;
        let gains = 0;
        let losses = 0;

        for (let i = prices.length - period; i < prices.length; i++) {
            const diff = prices[i] - prices[i - 1];
            if (diff >= 0) gains += diff;
            else losses -= diff;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - 100 / (1 + rs);
    }

    private calculateBollingerBandsPercentB(
        prices: number[],
        period: number = 20,
        multiplier: number = 2
    ): number {
        if (prices.length < period) return 0.5;

        const slice = prices.slice(-period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
        const stDev = Math.sqrt(variance);

        const upperBand = sma + multiplier * stDev;
        const lowerBand = sma - multiplier * stDev;
        const currentPrice = prices[prices.length - 1];

        const range = upperBand - lowerBand;
        return range === 0 ? 0.5 : (currentPrice - lowerBand) / range;
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!ScannerLogic.SCANNER_MARKETS.includes(symbol) || Number.isNaN(price)) {
            return this.getSortedStrategies();
        }

        if (this.cooldownTicksRemaining > 0) {
            this.cooldownTicksRemaining--;
            if (this.cooldownTicksRemaining === 0) {
                this.isBurstActive = true;
            }
            return this.getSortedStrategies();
        }

        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);

        if (this.priceBuffers[symbol].length > 50) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];

        // Default neutral scores while buffer warms up
        let bullishScore = 50;
        let bearishScore = 50;

        if (prices.length >= 10) {
            const currentEMA = this.calculateEMA(prices, 10);
            const currentRSI = this.calculateRSI(prices, 14);
            const percentB = this.calculateBollingerBandsPercentB(prices, 20);

            const latestPrice = prices[prices.length - 1];
            const isAboveEMA = latestPrice >= currentEMA;

            // Indicator weight blending
            const rsiFactor = (currentRSI - 50) * 0.5;   // RSI deviation from 50
            const bBandsFactor = (percentB - 0.5) * 35;  // Bollinger %B position
            const emaBonus = isAboveEMA ? 8 : -8;        // Trend filter bonus

            const compositeScore = 50 + rsiFactor + bBandsFactor + emaBonus;

            bullishScore = Math.min(94, Math.max(40, Math.round(compositeScore)));
            bearishScore = Math.min(94, Math.max(40, Math.round(100 - compositeScore)));
        }

        // Update only strategies tied to the incoming tick's symbol
        let symbolTopScore = 0;
        let symbolTopId = '';

        this.strategies = this.strategies.map(strat => {
            if (strat.market !== symbol && strat.symbol !== symbol) {
                return strat;
            }

            const score = strat.direction === 'UP' ? bullishScore : bearishScore;
            const stratId = strat.id || strat.name;

            if (score > symbolTopScore) {
                symbolTopScore = score;
                symbolTopId = stratId;
            }

            return {
                ...strat,
                confidence: score,
                score: score,
            };
        });

        // Per-symbol stabilization tracking
        const isStrongTrend = Math.abs(bullishScore - 50) > 20;
        if (symbolTopScore >= 82 && isStrongTrend) {
            this.consecutiveSweetSpotTicks[symbol] = (this.consecutiveSweetSpotTicks[symbol] || 0) + 1;
        } else {
            this.consecutiveSweetSpotTicks[symbol] = 0;
        }

        const hasStabilized =
            (this.consecutiveSweetSpotTicks[symbol] || 0) >= this.REQUIRED_STABILIZATION_TICKS;

        // Maintain sticky lock if active strategy still holds >= DISENGAGE_THRESHOLD
        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(
                s => (s.id || s.name) === this.activeSignalStrategyId
            );
            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD) {
                return this.getSortedStrategies();
            } else {
                this.activeSignalStrategyId = null;
            }
        }

        // Lock onto a newly stabilized high-conviction strategy if none is active
        if (!this.activeSignalStrategyId && hasStabilized && symbolTopId) {
            this.activeSignalStrategyId = symbolTopId;
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
