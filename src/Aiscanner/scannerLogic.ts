// src/Aiscanner/scannerLogic.ts
import { StrategyConfig, evaluateStrategySignal } from './strategies';

export function rankAndSortStrategies(
  strategies: StrategyConfig[],
  ticksBuffer: Record<string, number[]>
): StrategyConfig[] {
  return strategies
    .map((strat) => {
      const assetTicks = ticksBuffer[strat.asset] || [];
      const signal = evaluateStrategySignal(strat, assetTicks);
      return {
        ...strat,
        ...signal,
      };
    })
    .sort((a, b) => (b.score || 50) - (a.score || 50));
}
