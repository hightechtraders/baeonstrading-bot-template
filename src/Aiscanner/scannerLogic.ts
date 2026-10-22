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
    
    // Entry Stabilization Tracking
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
    private readonly COOLDOWN_DURATION_TICKS = 15; // Wait out 15 ticks of chop

    // Burst run tracking (Limit runs to 2-3 per stabilization window)
    private activeRunCount: number = 0;
    private readonly MAX_BURST_RUNS = 3; // Stop workspace after 3 successful/completed trades to reassess
    private isBurstActive: boolean = false;

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
        console.log("[AI Scanner]: Momentum engine with cooldown & burst run capping initialized.");
    }

    // Call this when a trade concludes
    public recordTradeOutcome(isWin: boolean) {
        if (isWin) {
            this.consecutiveLosses = 0;
            this.activeRunCount++;
            console.log(`✅ Trade won. Burst progress: ${this.activeRunCount}/${this.MAX_BURST_RUNS}`);

            // If we hit our burst limit (e.g., 3 trades), pause to reassess market stability
            if (this.activeRunCount >= this.MAX_BURST_RUNS) {
                console.log(`🎯 Burst limit reached (${this.MAX_BURST_RUNS} runs). Pausing to reassess clean trend.`);
                this.triggerCooldown("🎯 Burst target reached: Pausing to review market stability.");
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

        // Stop the bot workspace
        const stopBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Stop');
        if (stopBtn instanceof HTMLElement) {
            stopBtn.click();
        }

        // Alert UI banner
        window.dispatchEvent(new CustomEvent('ai-circuit-breaker-triggered', {
            detail: { message }
        }));
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return this.getSortedStrategies();
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        // Handle Cooldown Tick Countdown
        if (this.cooldownTicksRemaining > 0) {
            this.cooldownTicksRemaining--;
            
            if (this.cooldownTicksRemaining === 0) {
                this.isBurstActive = true;
                window.dispatchEvent(new CustomEvent('ai-circuit-breaker-triggered', {
                    detail: { message: `✅ Market Stabilized: Cooldown complete. Ready for a ${this.MAX_BURST_RUNS}-run burst.` }
                }));
            }

            return this.getSortedStrategies();
        }

        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        
        if (this.priceBuffers[symbol].length > 60) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices.length > 1 ? prices[prices.length - 2] : latestPrice;
        const netDiff = latestPrice - prevPrice;
        const liveDirection: 'UP' | 'DOWN' = netDiff >= 0 ? 'UP' : 'DOWN';

        if (!this.directionHistory[symbol]) {
            this.directionHistory[symbol] = [];
        }
        this.directionHistory[symbol].push(liveDirection);
        if (this.directionHistory[symbol].length > 8) {
            this.directionHistory[symbol].shift();
        }

        const history = this.directionHistory[symbol];
        const recentSlice = history.slice(-5);
        const matchingDirectionCount = recentSlice.filter(d => d === liveDirection).length;
        const isConfluent = recentSlice.length >= 5 && matchingDirectionCount >= 4;

        let marketMomentum = 55;
        if (prices.length >= 10) {
            const windowSize = Math.min(prices.length, 12);
            const oldestInWindow = prices[prices.length - windowSize];
            const priceDelta = latestPrice - oldestInWindow;
            const percentageChange = (priceDelta / oldestInWindow) * 100;
            
            const scaleFactor = (symbol.includes('10') || symbol.includes('R_10')) ? 7500 : 5000;
            const rawMagnitude = Math.abs(percentageChange) * scaleFactor;
            const confluenceBonus = isConfluent ? 22 : 0;
            
            marketMomentum = Math.min(96, Math.max(50, 55 + rawMagnitude + confluenceBonus));
        }

        let highestCalculatedScore = 0;
        let topStrategyId = '';

        this.strategies = this.strategies.map((strat) => {
            const isMatchingMarket = (strat.market || '').toUpperCase() === symbol.toUpperCase();
            const marketMultiplier = isMatchingMarket ? 1.0 : 0.88;

            let strategySpecificScore = Math.round(marketMomentum * marketMultiplier);
            strategySpecificScore = Math.min(96, Math.max(45, strategySpecificScore));

            const stratId = strat.id || strat.name;
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

        // Entry stabilization check
        if (highestCalculatedScore >= 89 && isConfluent) {
            this.consecutiveSweetSpotTicks[symbol] = (this.consecutiveSweetSpotTicks[symbol] || 0) + 1;
        } else {
            this.consecutiveSweetSpotTicks[symbol] = 0;
        }

        const hasStabilized = (this.consecutiveSweetSpotTicks[symbol] || 0) >= this.REQUIRED_STABILIZATION_TICKS;

        if (this.activeSignalStrategyId) {
            const currentActiveStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (currentActiveStrat && currentActiveStrat.confidence >= this.DISENGAGE_THRESHOLD && isConfluent) {
                return this.getSortedStrategies();
            } else {
                this.activeSignalStrategyId = null;
            }
        }

        if (!this.activeSignalStrategyId && hasStabilized && topStrategyId) {
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
