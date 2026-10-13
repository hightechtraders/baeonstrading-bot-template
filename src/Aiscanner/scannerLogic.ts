// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts
// Hybrid Responsive Engine with Chop Protection
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
        confidence: 50,
        score: 50
    }));

    private priceBuffers: { [symbol: string]: number[] } = {};
    private lockedUntil: number = 0;
    private lockedStrategyId: string | null = null;
    private readonly LOCK_DURATION_MS = 7000;

    public static readonly SCANNER_MARKETS: string[] = [
        '1HZ50V',
        '1HZ75V',
        '1HZ10V',
        '1HZ100V',
        'R_25',
        'R_75',
        'R_10'
    ];

    constructor() {
        console.log("[AI Scanner]: Hybrid responsive engine with chop protection initialized.");
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
        if (this.priceBuffers[symbol].length > 30) {
            this.priceBuffers[symbol].shift();
        }

        if (now < this.lockedUntil && this.lockedStrategyId) {
            return this.getSortedStrategies();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 4) {
            return this.getSortedStrategies();
        }

        const latest = prices[prices.length - 1];
        const prev = prices[prices.length - 2];
        const prev2 = prices[prices.length - 3];

        const direction = latest >= prev ? 'UP' : 'DOWN';
        const pctChange = Math.abs((latest - prev) / prev) * 100;

        // Light Chop Shield: Ensure ticks aren't just alternating randomly back and forth
        const isChoppy = (latest > prev && prev < prev2) || (latest < prev && prev > prev2);

        let triggeredHighConfidence = false;
        let targetStrategyId = '';

        this.strategies = this.strategies.map((strat, index) => {
            let baseScore = Math.min(95, Math.max(50, 60 + (pctChange * 200)));
            
            // If choppy, penalize score to prevent false breakout triggers
            if (isChoppy) {
                baseScore = 48;
            }

            const variance = (index % 3) * 1.2;
            const finalScore = Math.round(Math.min(98, Math.max(40, baseScore + variance)));

            if (finalScore >= 85 && !isChoppy && !triggeredHighConfidence) {
                triggeredHighConfidence = true;
                targetStrategyId = strat.id;
            }

            return {
                ...strat,
                confidence: finalScore,
                score: finalScore,
                market: symbol,
                direction
            };
        });

        if (triggeredHighConfidence && targetStrategyId) {
            this.lockedUntil = now + this.LOCK_DURATION_MS;
            this.lockedStrategyId = targetStrategyId;
        }

        return this.getSortedStrategies();
    }

    private getSortedStrategies(): Strategy[] {
        if (Date.now() < this.lockedUntil && this.lockedStrategyId) {
            const copy = [...this.strategies];
            const index = copy.findIndex(s => s.id === this.lockedStrategyId);
            if (index > 0) {
                const [lockedItem] = copy.splice(index, 1);
                copy.unshift(lockedItem);
                return copy;
            }
        }
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
