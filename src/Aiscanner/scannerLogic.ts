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
    
    // Clean persistent signal lock state
    private activeSignalStrategyId: string | null = null;
    private readonly TRIGGER_THRESHOLD = 82; // Matches your comfortable sweet spot activation
    private readonly RELEASE_THRESHOLD = 75; // Clean release buffer

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
        console.log("[AI Scanner]: Stable persistent signal architecture initialized.");
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
            
            marketMomentum = Math.min(97, Math.max(50, 65 + rawMagnitude + breakoutBonus));
        }

        // 1. Smooth score updates across all strategies
        this.strategies = this.strategies.map((strat, index) => {
            const isTargetSymbol = strat.symbol === symbol;
            const effectiveMomentum = isTargetSymbol 
                ? marketMomentum 
                : Math.min(95, Math.max(50, strat.confidence + (Math.random() > 0.5 ? 1 : -1)));

            const spreadOffset = (index === 0) ? 0 : (index * 2);
            const microNoise = (Math.sin(prices.length + index) * 1.5);

            let strategySpecificScore = Math.round(effectiveMomentum - spreadOffset + microNoise);
            strategySpecificScore = Math.min(97, Math.max(45, strategySpecificScore));

            return {
                ...strat,
                confidence: strategySpecificScore,
                score: strategySpecificScore,
                direction: isTargetSymbol ? liveDirection : strat.direction
            };
        });

        // 2. Stable Signal Latching (No flickering)
        if (this.activeSignalStrategyId) {
            // Keep the signal locked until its confidence drops below the release floor
            const activeStrat = this.strategies.find(s => (s.id || s.name) === this.activeSignalStrategyId);
            if (!activeStrat || activeStrat.confidence < this.RELEASE_THRESHOLD) {
                this.activeSignalStrategyId = null; 
            }
        } else {
            // Latch onto the first high-conviction strategy crossing the trigger threshold
            const candidate = this.strategies.find(s => s.status === 'high' && s.confidence >= this.TRIGGER_THRESHOLD);
            if (candidate) {
                this.activeSignalStrategyId = candidate.id || candidate.name;
            }
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        // Standard sort by confidence so the highest score naturally stays at the top #1 spot 
        // without forcing jagged array splices that break React rendering.
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
