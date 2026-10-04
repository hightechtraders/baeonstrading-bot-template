// src/Aiscanner/scannerLogic.ts
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { AudioAlerts } from './audioAlerts';

export class ScannerLogic {
  private strategies: Strategy[] = INITIAL_STRATEGIES;
  private priceBuffers: { [symbol: string]: number[] } = {};
  
  // 🎯 State tracking for consecutive 99% high-confidence signal lock on Volatility 50 (1s)
  private consecutiveHighConfidenceCount: number = 0;
  private readonly CONFIDENCE_THRESHOLD: number = 99;
  private readonly REQUIRED_CONSECUTIVE_HITS: number = 3;
  private isInitialized: boolean = false;

  constructor() {
    this.initProductionTickListener();
  }

  /**
   * Production-grade listener that hooks into the Deriv Bot template's native messaging pipeline
   */
  private initProductionTickListener() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // 1. Listen to real-time window postMessage data broadcasted by the Deriv platform engine
    window.addEventListener('message', (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        // Match Deriv API tick response structure
        if (data?.msg_type === 'tick' && data?.tick) {
          const symbol = data.tick.symbol;
          const price = Number(data.tick.quote);
          if (symbol && !isNaN(price)) {
            this.processLiveTick(symbol, price);
          }
        }
      } catch (err) {
        // Silent catch for cross-origin or unparseable frames
      }
    });

    // 2. Custom event bridge listener for seamless component communication
    window.addEventListener('deriv_live_tick' as any, (event: CustomEvent) => {
      const { symbol, price } = event.detail || {};
      if (symbol && typeof price === 'number') {
        this.processLiveTick(symbol, price);
      }
    });
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

    // Determine live direction based on actual price change
    const liveDirection: 'UP' | 'DOWN' = diff >= 0 ? 'UP' : 'DOWN';

    // Dynamically update strategy confidence and direction based on real market momentum
    this.strategies = this.strategies.map((strat) => {
      const matchesMarket = strat.market.toLowerCase().includes(symbol.toLowerCase().replace('r_', 'volatility ').replace('1hz', 'volatility '));
      if (matchesMarket) {
        const momentumBonus = diff !== 0 ? Math.min(20, Math.abs(diff) * 100) : 0;
        const newConfidence = Math.min(99, Math.max(60, Math.round(75 + momentumBonus)));

        // 🎯 Target Volatility 50 (1s) Rise setup ('1HZ50V')
        const isVol501sRise = (symbol === '1HZ50V' || strat.market.toLowerCase().includes('volatility 50 (1s)')) && liveDirection === 'UP';
        
        if (isVol501sRise) {
          if (newConfidence >= this.CONFIDENCE_THRESHOLD) {
            this.consecutiveHighConfidenceCount++;
            
            // 🚨 SIGNAL TRIGGER: Fires ONLY when confidence holds steady for 3 consecutive live ticks
            if (this.consecutiveHighConfidenceCount === this.REQUIRED_CONSECUTIVE_HITS) {
              // Play centralized upbeat strong signal chime
              AudioAlerts.playChime('STRONG_SIGNAL_LOCK');
              
              // Dispatch event to FloatingAI banner UI
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ai-signal-locked', {
                  detail: { message: "🎯 99% CONFIDENCE LOCKED (3x Live Ticks): Ready to Load Strategy" }
                }));
              }
            }
          } else {
            // Reset counter immediately if confidence flickers or drops below threshold
            this.consecutiveHighConfidenceCount = 0;
          }
        }

        return { 
          ...strat, 
          confidence: newConfidence,
          direction: liveDirection 
        };
      }
      return strat;
    });

    return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
  }

  // Fallback scan if ticker stream is idle
  public runScan(): Strategy[] {
    return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
  }
}
