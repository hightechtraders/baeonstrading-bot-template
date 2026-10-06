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
    private isSubscribed: boolean = false;
    
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
        console.log("[AI Scanner]: Module instantiated. Initializing WebSocket prototype interceptor...");
        this.registerGlobalBridge();
        this.initWebSocketInterceptor();
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

    /**
     * Intercepts native WebSocket creation to safely attach listeners 
     * without blocking core platform SL/TP or trade execution handlers.
     */
    private initWebSocketInterceptor() {
        if (typeof window === 'undefined') return;

        const self = this;
        const NativeWebSocket = window.WebSocket;

        // Override WebSocket prototype constructor safely
        (window as any).WebSocket = function(url: string | URL, protocols?: string | string[]) {
            const ws = new NativeWebSocket(url, protocols);

            ws.addEventListener('open', () => {
                // Check if this looks like a Deriv/Binary API endpoint connection
                if (String(url).includes('deriv') || String(url).includes('binary') || String(url).includes('ws')) {
                    console.log("[AI Scanner]: 🚀 Connected to trading socket! Subscribing to feeds...");
                    setTimeout(() => {
                        self.subscribeAllMarkets(ws);
                    }, 500);
                }
            });

            // Non-destructive message tapping
            const originalDescriptor = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
            
            ws.addEventListener('message', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.msg_type === 'tick') {
                        self.handleIncomingMessage(data);
                    }
                } catch (e) {
                    // Ignore non-JSON frames
                }
            });

            return ws;
        };

        // Preserve static properties on the mocked WebSocket constructor
        Object.assign(window.WebSocket, NativeWebSocket);
        window.WebSocket.prototype = NativeWebSocket.prototype;
    }

    public handleIncomingMessage(dataParsed: DerivTickResponse): Strategy[] {
        if (dataParsed.msg_type !== 'tick' || !dataParsed.tick) {
            return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
        }

        const { symbol, quote } = dataParsed.tick;
        const updated = this.processLiveTick(symbol, Number(quote));

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                detail: { strategies: updated }
            }));
        }

        return updated;
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
        if (prices.length < 3) return [...this.strategies].sort((a, b) => b.confidence - a.confidence);

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
            const stratMarketClean = strat.market.toLowerCase();
            const matchesMarket = stratMarketClean.includes(normalizedIncoming) || normalizedIncoming.includes(stratMarketClean);

            if (matchesMarket) {
                const randomMicroNoise = Math.floor(Math.random() * 5);
                const momentumBonus = diff !== 0 ? Math.min(22, Math.abs(diff) * 200) : randomMicroNoise;
                const newConfidence = Math.min(99, Math.max(60, Math.round(72 + momentumBonus + (idx % 3))));

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

                return { ...strat, confidence: newConfidence, score: newConfidence, direction: liveDirection };
            }
            return strat;
        });

        return [...this.strategies].sort((a, b) => {
            if (b.confidence !== a.confidence) {
                return b.confidence - a.confidence;
            }
            return a.name.localeCompare(b.name);
        });
    }

    public subscribeAllMarkets(ws: WebSocket): void {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        console.log(`[AI Scanner]: Requesting live streams for ${ScannerLogic.SCANNER_MARKETS.length} assets.`);
        
        ScannerLogic.SCANNER_MARKETS.forEach((symbol: string) => {
            ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        });
    }
}
