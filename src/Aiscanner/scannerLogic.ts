// scannerLogic.ts
import { StrategyConfig, enforceSingleHighPriority, evaluateStrategySignal } from './strategies';
import { scannerBridge } from './scannerBridge';

export class ScannerLogicManager {
  private strategies: StrategyConfig[] = [];
  private activeHighId: string | null = null;
  private lastSwitchTime = 0;
  private readonly MIN_HOLD_DURATION_MS = 2000; // 2-second stability hold rule

  constructor(initialStrategies: StrategyConfig[] = []) {
    this.setStrategies(initialStrategies);
  }

  /**
   * Set or update strategy list while strictly maintaining single HIGH priority rule.
   */
  public setStrategies(strategies: StrategyConfig[], targetHighId?: string): StrategyConfig[] {
    const defaultHigh = targetHighId || this.activeHighId || strategies[0]?.id;
    this.strategies = enforceSingleHighPriority(strategies, defaultHigh);
    this.activeHighId = defaultHigh;
    return this.strategies;
  }

  /**
   * Evaluates live ticks across all assets, updates scores/confidence,
   * and enforces the 2-second lock before switching HIGH priority.
   */
  public evaluateAndProcessTicks(
    ticksBuffer: Record<string, number[]>,
    symbolMap: Record<string, string> = {}
  ): StrategyConfig[] {
    const now = Date.now();

    // 1. Calculate real-time signals for every strategy
    const evaluated = this.strategies.map((strat) => {
      const symbol = symbolMap[strat.asset] || '1HZ100V';
      const ticks = ticksBuffer[symbol] || [];
      const signal = evaluateStrategySignal(strat, ticks);

      return {
        ...strat,
        score: signal.score,
        confidence: signal.confidence,
        direction: signal.direction,
      };
    });

    // 2. Identify strategy with highest confidence
    const rawWinner = [...evaluated].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

    // 3. Apply 2-Second Hold Rule: Only switch HIGH rank if 2 seconds have passed
    if (rawWinner && rawWinner.id !== this.activeHighId) {
      if (now - this.lastSwitchTime >= this.MIN_HOLD_DURATION_MS) {
        this.activeHighId = rawWinner.id;
        this.lastSwitchTime = now;
      }
    }

    if (!this.activeHighId && evaluated.length > 0) {
      this.activeHighId = evaluated[0].id;
    }

    // 4. Enforce single HIGH priority and sync back to class state
    const formatted = enforceSingleHighPriority(evaluated, this.activeHighId || undefined);
    this.strategies = formatted;

    // 5. Sort so HIGH priority strategy is always #1 in the list
    return [...formatted].sort((a, b) => {
      if (a.priority === 'HIGH') return -1;
      if (b.priority === 'HIGH') return 1;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });
  }

  /**
   * Select a new strategy to be the single 'HIGH' priority winner manually.
   */
  public setHighPriority(strategyId: string): StrategyConfig[] {
    return this.setStrategies(this.strategies, strategyId);
  }

  /**
   * Safely update editable parameters (stake, stopLoss, takeProfit).
   * Restricted strictly to the single active HIGH strategy.
   */
  public updateStrategyParams(
    strategyId: string,
    updates: Partial<Pick<StrategyConfig, 'stake' | 'stopLoss' | 'takeProfit'>>
  ): StrategyConfig[] {
    const target = this.strategies.find((s) => s.id === strategyId);

    if (!target) {
      console.warn(`[ScannerLogic] Strategy ID "${strategyId}" not found.`);
      return this.strategies;
    }

    if (target.priority !== 'HIGH') {
      console.warn(`[ScannerLogic] Cannot edit strategy "${target.name}". Only HIGH priority strategies are editable.`);
      return this.strategies;
    }

    this.strategies = this.strategies.map((strat) => {
      if (strat.id === strategyId) {
        return { ...strat, ...updates };
      }
      return strat;
    });

    return this.strategies;
  }

  /**
   * Triggers loading the active HIGH priority strategy into the Blockly workspace.
   */
  public loadHighStrategyToWorkspace(strategyId: string): boolean {
    const strategy = this.strategies.find((s) => s.id === strategyId);

    if (!strategy) {
      console.error(`[ScannerLogic] Strategy ID "${strategyId}" does not exist.`);
      return false;
    }

    if (strategy.priority !== 'HIGH') {
      console.error(`[ScannerLogic] Strategy "${strategy.name}" is not HIGH priority. Blocked.`);
      return false;
    }

    return scannerBridge.loadStrategyToBot(strategy);
  }

  /**
   * Returns current active strategies array.
   */
  public getStrategies(): StrategyConfig[] {
    return this.strategies;
  }
}

export const scannerLogic = new ScannerLogicManager();
