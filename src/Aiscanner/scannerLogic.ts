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
    
    private readonly CONFIDENCE_THRESHOLD: number = 94;
    private readonly REQUIRED_CONSECUTIVE_HITS: number = 5; // Stricter requirement for strong directional runs

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
        console.log("[AI Scanner]: Module instantiated with strict impulse momentum filters.");
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
        if (this.priceBuffers[symbol].length > 45) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 12) return [...this.strategies].sort((a, b) => b.confidence - a.confidence);

        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2];
        const diff = latestPrice - prevPrice;
        
        const liveDirection: 'UP' | 'DOWN' = diff > 0 ? 'UP' : diff < 0 ? 'DOWN' : (Math.random() > 0.5 ? 'UP' : 'DOWN');
        const cleanSymbol = symbol.toUpperCase();

        // Calculate Exponential/Simple Moving Average (SMA) over the last 6 ticks
        const recentPrices = prices.slice(-6);
        const sma6 = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
        
        // Calculate average tick volatility to filter out noise
        let totalVariance = 0;
        for (let i = 1; i < recentPrices.length; i++) {
            totalVariance += Math.abs(recentPrices[i] - recentPrices[i - 1]);
        }
        const avgVolatility = totalVariance / (recentPrices.length - 1);
        
        // Require price to be decisively away from SMA and volatility to be healthy
        const isStrongImpulse = liveDirection === 'UP' 
            ? (latestPrice > sma6 && Math.abs(diff) >= avgVolatility * 0.8)
            : (latestPrice < sma6 && Math.abs(diff) >= avgVolatility * 0.8);

        // Calculate consecutive directional consistency
        let consecutiveCount = 0;
        for (let i = prices.length - 1; i > 0; i--) {
            const currentDiff = prices[i] - prices[i - 1];
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
                // If market lacks consecutive momentum OR fails impulse velocity checks, suppress score
                if (consecutiveCount < this.REQUIRED_CONSECUTIVE_HITS || !isStrongImpulse) {
                    const choppyScore = Math.max(20, 35 + (consecutiveCount * 2));
                    return {
                        ...strat,
                        confidence: choppyScore,
                        score: choppyScore,
                        direction: liveDirection
                    };
                }

                // High-probability mathematical calculation for consistent impulse wins
                const impulseBoost = Math.min(18, Math.abs(diff) * 250);
                const streakBonus = consecutiveCount * 2;
                
                const calculatedConfidence = Math.round(80 + impulseBoost + streakBonus);
                const newConfidence = Math.min(98, Math.max(88, calculatedConfidence));

                return { 
                    ...strat, 
                    confidence: newConfidence, 
                    score: newConfidence, 
                    direction: liveDirection 
                };
            } else {
                const subtleDrift = Math.max(20, Math.min(45, strat.confidence + (Math.floor(Math.random() * 5) - 2)));
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
