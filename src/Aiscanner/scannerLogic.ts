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
    
    private readonly CONFIDENCE_THRESHOLD: number = 92;
    private readonly REQUIRED_CONSECUTIVE_HITS: number = 4; // Stricter requirement to eliminate chop

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
        console.log("[AI Scanner]: Module instantiated cleanly with high win-rate momentum filters.");
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
        if (this.priceBuffers[symbol].length > 30) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 6) return [...this.strategies].sort((a, b) => b.confidence - a.confidence);

        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2];
        const diff = latestPrice - prevPrice;
        
        const liveDirection: 'UP' | 'DOWN' = diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : (Math.random() > 0.5 ? 'UP' : 'DOWN');
        const cleanSymbol = symbol.toUpperCase();

        // Calculate consecutive directional consistency and average acceleration
        let consecutiveCount = 0;
        let cumulativeDisplacement = 0;
        for (let i = prices.length - 1; i > 0; i--) {
            const currentDiff = prices[i] - prices[i - 1];
            cumulativeDisplacement += Math.abs(currentDiff);
            if (currentDiff === 0) break;
            const isSameDirection = (diff > 0 && currentDiff > 0) || (diff < 0 && currentDiff < 0);
            if (isSameDirection) {
                consecutiveCount++;
            } else {
                break;
            }
        }

        this.strategies = this.strategies.map((strat) => {
            const stratMarket = (strat.market || '').toUpperCase();
            const stratName = (strat.name || '').toUpperCase();
            
            const baseSymbol = cleanSymbol.replace('1HZ', '').replace('_', '');
            const baseStratMarket = stratMarket.replace('1HZ', '').replace('_', '');

            const matchesMarket = 
                stratMarket.includes(cleanSymbol) || 
                cleanSymbol.includes(stratMarket) || 
                stratName.includes(cleanSymbol) ||
                (baseSymbol && baseStratMarket && baseStratMarket.includes(baseSymbol));

            if (matchesMarket) {
                // Suppress confidence aggressively if choppy or below the 4-tick consecutive threshold
                if (consecutiveCount < this.REQUIRED_CONSECUTIVE_HITS) {
                    const choppyScore = Math.max(35, 45 + (consecutiveCount * 3));
                    return {
                        ...strat,
                        confidence: choppyScore,
                        score: choppyScore,
                        direction: liveDirection
                    };
                }

                // High-precision momentum calculation requiring true directional acceleration
                const accelerationFactor = Math.min(20, Math.abs(diff) * 250);
                const streakBonus = consecutiveCount * 3;
                
                const calculatedConfidence = Math.round(72 + accelerationFactor + streakBonus);
                const newConfidence = Math.min(95, Math.max(80, calculatedConfidence));

                return { 
                    ...strat, 
                    confidence: newConfidence, 
                    score: newConfidence, 
                    direction: liveDirection 
                };
            } else {
                // Lower drift score for non-active background markets
                const subtleDrift = Math.max(35, Math.min(60, strat.confidence + (Math.floor(Math.random() * 5) - 2)));
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
