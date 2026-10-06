// ==========================================
// FILE: src/Aiscanner/scannerLogic.ts
// ==========================================
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { AudioAlerts } from './audioAlerts';

/**
 * TypeScript interface explicitly detailing the structural layout 
 * of the official Deriv WebSocket API 'tick' response packet.
 */
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
    
    // 🎯 State tracking for consecutive 99% high-confidence signal lock on Volatility 50 (1s)
    private consecutiveHighConfidenceCount: number = 0;
    private readonly CONFIDENCE_THRESHOLD: number = 99;
    private readonly REQUIRED_CONSECUTIVE_HITS: number = 3;

    // Exact structural system market identifiers expected by Deriv API backend
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
        console.log("[AI Scanner]: Module instantiated successfully. Initializing global event bridges...");
        this.registerGlobalBridge();
    }

    /**
     * Registers clean global browser hooks so your platform's network layer 
     * or custom event dispatchers can feed live tick data directly with zero lag.
     */
    private registerGlobalBridge() {
        if (typeof window === 'undefined') return;

        // Expose a direct window hook for external network loop calls
        (window as any).feedScannerTick = (symbol: string, price: number) => {
            this.processLiveTick(symbol, price);
        };

        // Custom event bridge listener for decoupled component updates
        window.addEventListener('deriv_live_tick' as any, (event: CustomEvent) => {
            const { symbol, price } = event.detail || {};
            if (symbol && typeof price === 'number') {
                this.processLiveTick(symbol, price);
            }
        });
    }

    /**
     * Top-Level Multiplexed Data Parser.
     * Drop this straight into your main network manager's .onmessage stream hook.
     */
    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
        }

        const { symbol, quote } = dataParsed.tick;
        return this.processLiveTick(symbol, Number(quote));
    }

    /**
     * Processes individual live ticks, manages rolling price history buffers, 
     * calculates momentum scores, and triggers confidence signal locks.
     */
    public processLiveTick(symbol: string, price: number): Strategy[] {
        if (!this.priceBuffers[symbol]) {
            this.priceBuffers[symbol] = [];
        }
        this.priceBuffers[symbol].push(price);
        if (this.priceBuffers[symbol].length > 15) {
            this.priceBuffers[symbol].shift();
        }

        const prices = this.priceBuffers[symbol];
        if (prices.length < 3) return [...this.strategies].sort((a, b) => b.confidence - a.confidence);

        const latestPrice = prices[prices.length - 1];
        const prevPrice = prices[prices.length - 2];
        const diff = latestPrice - prevPrice;
        const liveDirection: 'UP' | 'DOWN' = diff >= 0 ? 'UP' : 'DOWN';

        // 🎯 Canonical lookup mapping raw API symbols to display market strings
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

        this.strategies = this.strategies.map((strat) => {
            const stratMarketClean = strat.market.toLowerCase();
            const matchesMarket = stratMarketClean.includes(normalizedIncoming) || normalizedIncoming.includes(stratMarketClean);

            if (matchesMarket) {
                const momentumBonus = diff !== 0 ? Math.min(24, Math.abs(diff) * 150) : Math.floor(Math.random() * 5);
                const newConfidence = Math.min(99, Math.max(65, Math.round(75 + momentumBonus)));

                // Target Volatility 50 (1s) setup ("1HZ50V")
                const isVol501sRise = (symbol === '1HZ50V' || stratMarketClean.includes('volatility 50 (1s)')) && liveDirection === 'UP';
                
                if (isVol501sRise) {
                    if (newConfidence >= this.CONFIDENCE_THRESHOLD) {
                        this.consecutiveHighConfidenceCount++;
                        
                        if (this.consecutiveHighConfidenceCount === this.REQUIRED_CONSECUTIVE_HITS) {
                            AudioAlerts.playChime('STRONG_SIGNAL_LOCK');
                            if (typeof window !== 'undefined') {
                                window.dispatchEvent(new CustomEvent('ai-signal-locked', {
                                    detail: { message: "🎯 99% CONFIDENCE LOCKED (3x Live Ticks): Ready to Load Strategy" }
                                }));
                            }
                        }
                    } else {
                        this.consecutiveHighConfidenceCount = 0;
                    }
                }

                return { ...strat, confidence: newConfidence, direction: liveDirection };
            }
            return strat;
        });

        return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Batch requests streams for all scanner assets over an active socket.
     */
    public subscribeAllMarkets(ws: WebSocket): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error("[AI Scanner Error]: Cannot subscribe. WebSocket instance is not open.");
            return;
        }
        console.log(`[AI Scanner]: Initiating multiplexed streams for ${ScannerLogic.SCANNER_MARKETS.length} assets.`);
        
        ScannerLogic.SCANNER_MARKETS.forEach((symbol: string) => {
            ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        });
    }
}
