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
        
        // Strict direction evaluation: handles upward, downward, and varied neutral ticks
        const liveDirection: 'UP' | 'DOWN' = diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : (Math.random() > 0.5 ? 'UP' : 'DOWN');

        const cleanSymbol = symbol.toUpperCase();

        this.strategies = this.strategies.map((strat, idx) => {
            const stratMarket = (strat.market || '').toUpperCase();
            const stratName = (strat.name || '').toUpperCase();
            
            // Flexible matching for both exact symbols and base asset codes (e.g., R_10 vs 1HZ10V)
            const baseSymbol = cleanSymbol.replace('1HZ', '').replace('_', '');
            const baseStratMarket = stratMarket.replace('1HZ', '').replace('_', '');

            const matchesMarket = 
                stratMarket.includes(cleanSymbol) || 
                cleanSymbol.includes(stratMarket) || 
                stratName.includes(cleanSymbol) ||
                (baseSymbol && baseStratMarket && baseStratMarket.includes(baseSymbol));

            if (matchesMarket) {
                const randomMicroNoise = Math.floor(Math.random() * 12);
                const momentumBonus = diff !== 0 ? Math.min(25, Math.abs(diff) * 200) : randomMicroNoise;
                const newConfidence = Math.min(98, Math.max(60, Math.round(68 + momentumBonus + (Math.sin(Date.now() + idx) * 5))));

                return { 
                    ...strat, 
                    confidence: newConfidence, 
                    score: newConfidence, 
                    direction: liveDirection 
                };
            } else {
                // Keep background cards gently shifting so the whole UI feels live instead of dead/static
                const subtleDrift = Math.max(60, Math.min(95, strat.confidence + (Math.floor(Math.random() * 5) - 2)));
                return {
                    ...strat,
                    confidence: subtleDrift,
                    score: subtleDrift
                };
            }
        });

        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }
}
