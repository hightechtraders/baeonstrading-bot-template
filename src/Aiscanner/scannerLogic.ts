// src/Aiscanner/scannerLogic.ts

import { CORE_7_STRATEGIES, TickData } from './strategies';

export interface EvaluatedStrategy {
  id: string;
  name: string;
  symbol: string;
  type: string;
  variant: string;
  confidence: number;
  score: number;
  badgeLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  direction: 'RISE' | 'FALL' | 'READY';
  parameters: {
    stake: number;
    stopLoss: number;
    takeProfit: number;
  };
}

export class ScannerEngine {
  private tickStore: Record<string, TickData[]> = {};

  /**
   * Processes an incoming market tick and re-evaluates active strategies.
   */
  public processTick(symbol: string, tick: TickData): EvaluatedStrategy[] {
    if (!this.tickStore[symbol]) {
      this.tickStore[symbol] = [];
    }

    // Push tick to buffer
    this.tickStore[symbol].push(tick);

    // Keep trailing 50 ticks for calculations
    if (this.tickStore[symbol].length > 50) {
      this.tickStore[symbol].shift();
    }

    const currentTicks = this.tickStore[symbol];

    // Evaluate all 7 strategies against current tick buffer
    return CORE_7_STRATEGIES.map((strat) => {
      const res = strat.evaluate(currentTicks);

      let badgeLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (res.confidence >= 0.8) badgeLevel = 'HIGH';
      else if (res.confidence >= 0.7) badgeLevel = 'MEDIUM';

      return {
        id: strat.id,
        name: strat.name,
        symbol: strat.symbol,
        type: strat.type,
        variant: strat.variant,
        confidence: res.confidence,
        score: res.score,
        badgeLevel,
        direction: res.direction,
        parameters: { ...strat.parameters },
      };
    });
  }
}
