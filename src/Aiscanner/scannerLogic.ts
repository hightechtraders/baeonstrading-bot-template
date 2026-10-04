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
    private strategies: Strategy[] = INITIAL_STRATEGIES;
    private priceBuffers: { [symbol: string]: number[] } = {};
    
    // 🎯 Sniper State Tracking
    private consecutiveHighConfidenceCount: number = 0;
    private readonly CONFIDENCE_THRESHOLD: number = 99;
    private readonly REQUIRED_CONSECUTIVE_HITS: number = 3;
    private static lastSniperTriggerTime: number = 0;
    private static readonly SNIPER_COOLDOWN_MS: number = 20000; // 20s cooldown between sniper locks

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
        console.log("[AI Sniper Scanner]: Initialized with strict structural filters.");
        this.registerGlobalBridge();
    }

    private registerGlobalBridge() {
        if (typeof window === 'undefined') return;

        (window as any).feedScannerTick = (symbol: string, price: number) => {
            this.processLiveTick(symbol, price);
        };

        window.addEventListener('deriv_live_tick' as any, (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
                this.processLiveTick(symbol, price);
            }
        });
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    /**
     * Sniper Processing Engine: Combines Momentum, Moving Average Structure, 
     * and Cooldown Gating to isolate genuine high-probability entries.
     */
    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        if (this.priceBuffers[symbol].length > 20) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 5) return [...this.strategies].sort((a, b) => b.confidence - a.confidence);

        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2];
        const diff = latestPrice - prevPrice;
        const liveDirection: 'UP' | 'DOWN' = diff >= 0 ? 'UP' : 'DOWN';

        // 🛡️ Sniper Filter 1: Short-term Moving Average (SMA 5) for trend confirmation
        const recentTicks = prices.slice(-5);
        const sma5 = recentTicks.reduce((sum, p) => sum + p, 0) / recentTicks.length;
        const isAboveTrend = latestPrice > sma5;

        // 🛡️ Sniper Filter 2: Velocity / Acceleration check (avoid micro-jitter noise)
        const avgVelocity = Math.abs(prices[prices.length - 2] - prices[prices.length - 3]);
        const isAccelerating = Math.abs(diff) >= (avgVelocity * 0.8);

        this.strategies = this.strategies.map((strat) => {
            const matchesMarket = strat.market.toLowerCase().includes(symbol.toLowerCase().replace('r_', 'volatility ').replace('1hz', 'volatility '));
            
            if (matchesMarket) {
                // Strict sniper confidence score calculation
                const baseScore = (isAboveTrend && isAccelerating && diff > 0) ? 90 : 70;
                const momentumBonus = Math.min(9, Math.abs(diff) * 2000);
                const newConfidence = Math.min(99, Math.max(50, Math.round(baseScore + momentumBonus)));

                // Target Volatility 50 (1s) setup ("1HZ50V")
                const isVol501sSetup = (symbol === '1HZ50V' || strat.market.toLowerCase().includes('volatility 50 (1s)')) 
                    && liveDirection === 'UP' 
                    && isAboveTrend 
                    && isAccelerating;

                if (isVol501sSetup) {
                    if (newConfidence >= this.CONFIDENCE_THRESHOLD) {
                        this.consecutiveHighConfidenceCount++;
                        
                        if (this.consecutiveHighConfidenceCount >= this.REQUIRED_CONSECUTIVE_HITS) {
                            const now = Date.now();
                            // Check global cooldown to prevent spamming trades
                            if (now - ScannerLogic.lastSniperTriggerTime > ScannerLogic.SNIPER_COOLDOWN_MS) {
                                ScannerLogic.lastSniperTriggerTime = now;
                                AudioAlerts.playChime('STRONG_SIGNAL_LOCK');
                                
                                if (typeof window !== 'undefined') {
                                    window.dispatchEvent(new CustomEvent('ai-signal-locked', {
                                        detail: { 
                                            symbol: '1HZ50V',
                                            contractType: 'rise',
                                            stake: strat.recommendedStake || 10,
                                            message: "🎯 SNIPER 99% CONFIDENCE LOCKED: Trend + Acceleration Verified" 
                                        }
                                    }));
                                }
                            }
                            this.consecutiveHighConfidenceCount = 0;
                        }
                    } else {
                        this.consecutiveHighConfidenceCount = Math.max(0, this.consecutiveHighConfidenceCount - 1);
                    }
                }

                return { ...strat, confidence: newConfidence, direction: liveDirection };
            }
            return strat;
        });

        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }

    public runScan(): Strategy[] {
        // Fallback simulation runner
        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }

    public subscribeAllMarkets(ws: WebSocket): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error("[AI Sniper Error]: WebSocket is not open.");
            return;
        }
        console.log(`[AI Sniper]: Subscribing to ${ScannerLogic.SCANNER_MARKETS.length} sniper markets.`);
        ScannerLogic.SCANNER_MARKETS.forEach((symbol: string) => {
            ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        });
    }
}
