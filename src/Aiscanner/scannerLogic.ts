import { Strategy, INITIAL_STRATEGIES } from './strategies';

export class ScannerLogic {
  private strategies: Strategy[] = INITIAL_STRATEGIES;
  private priceBuffers: { [symbol: string]: number[] } = {};

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
      // Optionally randomize or alternate direction slightly during fallback simulation
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
