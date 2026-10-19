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
    
    // Strict 85% to 97% holding rule
    private activeSignalStrategyId: string | null = null;
    private readonly MIN_LOCK_THRESHOLD = 85; 
    private readonly MAX_LOCK_THRESHOLD = 97; 

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
        console.log("[AI Scanner]: Strict 85%-97% persistent signal hold initialized.");
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
        if (this.priceBuffers[symbol].length > 40) {
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
        if (this.directionHistory[symbol].length > 5) {
            this.directionHistory[symbol].shift();
        }

        let marketMomentum = 65; 
        if (prices.length >= 4) {
            const windowSize = Math.min(prices.length, 6);
            const baselinePrice = prices[prices.length - windowSize];
            const priceDelta = latestPrice - baselinePrice;
            const percentageChange = (priceDelta / baselinePrice) * 100;
            
            const scaleFactor = (symbol.includes('10') || symbol.includes('R_10')) ? 9000 : 7000;
            const rawMagnitude = Math.abs(percentageChange) * scaleFactor;
            const isBreakoutValid = rawMagnitude > 5 && netDiff !== 0;
            const breakoutBonus = isBreakoutValid ? 25 : 10;
            
            marketMomentum = Math.min(this.MAX_LOCK_THRESHOLD, Math.max(50, 65 + rawMagnitude + breakoutBonus));
        }

        // 1. Refresh scores across all strategies
        this.strategies = this.strategies.map((strat, index) => {
            const isTargetSymbol = strat.symbol === symbol;
            const effectiveMomentum = isTargetSymbol 
                ? marketMomentum 
                : Math.min(95, Math.max(50, strat.confidence + (Math.random() > 0.5 ? 1 : -1)));

            const spreadOffset = (index === 0) ? 0 : (index * 2);
            const microNoise = (Math.sin(prices.length + index) * 1.5);

            let strategySpecificScore = Math.round(effectiveMomentum - spreadOffset + microNoise);
            strategySpecificScore = Math.min(this.MAX_LOCK_THRESHOLD, Math.max(45, strategySpecificScore));

            return {
                ...strat,
                confidence: strategySpecificScore,
                score: strategySpecificScore,
                direction: isTargetSymbol ? liveDirection : strat.direction
            };
        });

        // 2. Strict Holding & Release Enforcement
        if (this.activeSignalStrategyId) {
            // Find the currently locked strategy in our fresh array
            const activeStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            
            // RELEASE: Only drop the signal if it drops below 85% or loses its 'high' status
            if (!activeStrat || activeStrat.confidence < this.MIN_LOCK_THRESHOLD || activeStrat.status !== 'high') {
                this.activeSignalStrategyId = null; 
            }
        } else {
            // LOCK: Trigger when a 'high' strategy hits between 85% and 97%
            const candidate = this.strategies.find(
                s => s.status === 'high' && s.confidence >= this.MIN_LOCK_THRESHOLD && s.confidence <= this.MAX_LOCK_THRESHOLD
            );
            if (candidate) {
                this.activeSignalStrategyId = candidate.id || candidate.name;
            }
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        // FORCE PIN: If a signal is active, splice it and anchor it permanently at index [0].
        // This guarantees the UI banner stays locked on screen without flashing or shifting out of place.
        if (this.activeSignalStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (index !== -1) {
                const [stickyItem] = copy.splice(index, 1);
                copy.unshift(stickyItem);
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
