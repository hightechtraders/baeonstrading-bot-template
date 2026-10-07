// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts
// ==========================================
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { AudioAlerts } from './audioAlerts';

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
        name: s.name && s.name !== 'Connecting to Live Deriv Feed...' ? s.name : 'Volatility 75 AI Scalper',
        market: s.market || 'R_75',
        confidence: s.confidence || 75
    }));
    private priceBuffers: { [symbol: string]: number[] } = {};
    
    private consecutiveHighConfidenceCount: number = 0;
    private readonly CONFIDENCE_THRESHOLD: number = 99;
    private readonly REQUIRED_CONSECUTIVE_HITS: number = 3;

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
        console.log("[AI Scanner]: Module instantiated cleanly.");
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        if (this.priceBuffers[symbol].length > 15) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 2) return [...this.strategies].sort((a, b) => b.confidence - a.confidence);

        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2];
        const diff = latestPrice - prevPrice;
        const liveDirection: 'UP' | 'DOWN' = diff >= 0 ? 'UP' : 'DOWN';

        const symbolToNameMap: Record<string, string> = {
            '1HZ50V': 'volatility 50 (1s)',
            '1HZ75V': 'volatility 75 (1s)',
            '1HZ10V': 'volatility 10 (1s)',
            '1HZ100V': 'volatility 100 (1s)',
            'R_25': 'volatility 25',
            'R_75': 'volatility 75',
            'R_10': 'volatility 10'
        };

        const normalizedIncoming = symbolToNameMap[symbol] || symbol.toLowerCase();

        this.strategies = this.strategies.map((strat, idx) => {
            const stratMarketClean = (strat.market || '').toLowerCase();
            const matchesMarket = stratMarketClean.includes(normalizedIncoming) || normalizedIncoming.includes(stratMarketClean);

            if (matchesMarket) {
                const randomMicroNoise = Math.floor(Math.random() * 6);
                const momentumBonus = diff !== 0 ? Math.min(25, Math.abs(diff) * 150) : randomMicroNoise;
                const newConfidence = Math.min(99, Math.max(65, Math.round(70 + momentumBonus + (idx % 5))));

                return { ...strat, confidence: newConfidence, score: newConfidence, direction: liveDirection };
            }
            return strat;
        });

        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
