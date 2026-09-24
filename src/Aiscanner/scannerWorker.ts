// scanner.worker.ts
import { evaluateStrategySignal, StrategyConfig, StrategySignal } from './strategies';

const ctx: Worker = self as any;

interface WorkerInputMessage {
  type: 'TICK_UPDATE' | 'RUN_SCAN';
  payload: {
    asset: string;
    ticks: number[];
    strategies: StrategyConfig[];
  };
}

ctx.onmessage = (event: MessageEvent<WorkerInputMessage>) => {
  const { type, payload } = event.data;

  if (type === 'TICK_UPDATE' || type === 'RUN_SCAN') {
    const { asset, ticks, strategies } = payload;
    const results: StrategySignal[] = [];

    for (const strat of strategies) {
      if (strat.asset === asset) {
        const signal = evaluateStrategySignal(strat, ticks);

        results.push({
          strategyId: strat.id,
          direction: signal.direction,
          confidence: signal.confidence,
          score: signal.score,
          timestamp: Date.now(),
        });
      }
    }

    ctx.postMessage({
      type: 'SCAN_RESULTS',
      payload: results,
    });
  }
};

export {};
