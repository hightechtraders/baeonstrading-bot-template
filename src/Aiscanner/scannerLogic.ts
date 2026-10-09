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
        confidence: s.confidence || 75
    }));
    private priceBuffers: { [symbol: string]: number[] } = {};
    
    // Persistence lock state to prevent frantic reshuffling
    private lockedUntil: number = 0;
    private lockedStrategyId: string | null = null;
    private readonly LOCK_DURATION_MS = 7000; // Freeze high-conviction signal for 7 seconds

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
        console.log("[AI Scanner]: Signal locking and persistence filter active.");
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
        if (this.priceBuffers[symbol].length > 40) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 12) return this.getSortedStrategies();

        // If a high-conviction signal is currently locked, keep the sorting frozen to avoid reshuffling
        if (now < this.lockedUntil && this.lockedStrategyId) {
            return this.getSortedStrategies();
        }

        const latestPrice = prices[prices.length - 1];
        const prevPrice3 = prices[prices.length - 4]; 
        const netDiff = latestPrice - prevPrice3;
        
        const liveDirection: 'UP' | 'DOWN' = netDiff >= 0 ? 'UP' : 'DOWN';
        const cleanSymbol = symbol.toUpperCase();

        let consecutiveCount = 0;
        for (let i = prices.length - 1; i > prices.length - 5; i--) {
            if (i <= 0) break;
            const diff = prices[i] - prices[i - 1];
            if ((netDiff > 0 && diff >= 0) || (netDiff < 0 && diff <= 0)) {
                consecutiveCount++;
            }
        }

        let triggeredHighConfidence = false;
        let targetStrategyId = '';

        this.strategies = this.strategies.map((strat) => {
            const stratMarket = (strat.market || '').toUpperCase();
            const matchesMarket = stratMarket.includes(cleanSymbol) || cleanSymbol.includes(stratMarket);

            if (matchesMarket) {
                if (consecutiveCount < 3 || Math.abs(netDiff) < 0.02) {
                    return {
                        ...strat,
                        confidence: 45,
                        score: 45,
                        direction: liveDirection
                    };
                }

                triggeredHighConfidence = true;
                targetStrategyId = strat.id || strat.name;

                return { 
                    ...strat, 
                    confidence: 96, 
                    score: 96, 
                    direction: liveDirection 
                };
            } else {
                return {
                    ...strat,
                    confidence: 30,
                    score: 30
                };
            }
        });

        // Activate the lock if a strong signal is found
        if (triggeredHighConfidence && targetStrategyId) {
            this.lockedUntil = now + this.LOCK_DURATION_MS;
            this.lockedStrategyId = targetStrategyId;
            
            // Optional browser audio cue / notification hook
            if (typeof window !== 'undefined') {
                console.log(`%c[STRONG SIGNAL LOCKED]: ${targetStrategyId} - Direction: ${liveDirection}`, 'background: #222; color: #bada55; padding: 4px;');
            }
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        // If locked, place the locked strategy explicitly at the top index
        if (Date.now() < this.lockedUntil && this.lockedStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => (s.id || s.name) === this.lockedStrategyId);
            if (index > 0) {
                const [lockedItem] = copy.splice(index, 1);
                copy.unshift(lockedItem);
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
