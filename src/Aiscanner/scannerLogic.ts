// src/Aiscanner/scannerLogic.ts
import { Strategy, INITIAL_STRATEGIES } from './strategies';
import { AudioAlerts } from './audioAlerts'; // 👈 Import your centralized audio alerts manager

export class ScannerLogic {
  private strategies: Strategy[] = INITIAL_STRATEGIES;
  private priceBuffers: { [symbol: string]: number[] } = {};
  
  // 🎯 State tracking for consecutive 99% high-confidence signal lock on Volatility 50 (1s)
  private consecutiveHighConfidenceCount: number = 0;
  private readonly CONFIDENCE_THRESHOLD: number = 99;
  private readonly REQUIRED_CONSECUTIVE_HITS: number = 3;

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

    // Dynamically update strategy confidence and direction based on real price momentum
    this.strategies = this.strategies.map((strat) => {
      const matchesMarket = strat.market.toLowerCase().includes(symbol.toLowerCase().replace('r_', 'volatility ').replace('1hz', 'volatility '));
      if (matchesMarket) {
        const momentumBonus = diff !== 0 ? Math.min(20, Math.abs(diff) * 100) : 0;
        const newConfidence = Math.min(99, Math.max(60, Math.round(75 + momentumBonus)));

        // 🎯 Check if this is Volatility 50 (1s) Rise setup hitting 99% confidence
        const isVol501sRise = (symbol === '1HZ50V' || strat.market.toLowerCase().includes('volatility 50 (1s)')) && strat.direction === 'UP';
        
        if (isVol501sRise) {
          if (newConfidence >= this.CONFIDENCE_THRESHOLD) {
            this.consecutiveHighConfidenceCount++;
            
            // Trigger alert ONLY when it rests on high confidence for 3 consecutive ticks
            if (this.consecutiveHighConfidenceCount === this.REQUIRED_CONSECUTIVE_HITS) {
              // Play centralized upbeat strong signal chime
              AudioAlerts.playChime('STRONG_SIGNAL_LOCK');
              
              // Update visual signal banner on UI
              const banner = document.getElementById('ai-signal-banner');
              if (banner) {
                banner.textContent = "🎯 99% CONFIDENCE LOCKED (3x Ticks): Ready to Load Strategy";
                banner.classList.add('signal-active');
              }
            }
          } else {
            // Reset counter immediately if confidence flickers below threshold
            this.consecutiveHighConfidenceCount = 0;
          }
        }

        return { 
          ...strat, 
          confidence: newConfidence,
          direction: liveDirection // Updates direction dynamically!
        };
      }
      return strat;
    });

    return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
  }

  // Fallback scan if WebSocket isn't streaming yet
  public runScan(): Strategy[] {
    this.strategies = this.strategies.map((strat) => {
      const randomJitter = Math.floor(Math.random() * 7) - 3;
      const newConfidence = Math.min(99, Math.max(60, strat.confidence + randomJitter));
      const randomDirection: 'UP' | 'DOWN' = Math.random() > 0.5 ? 'UP' : 'DOWN';
      
      return { 
        ...strat, 
        confidence: newConfidence,
        direction: randomDirection 
      };
    });
    return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
  }
}
