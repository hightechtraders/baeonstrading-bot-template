// scannerLogic.ts
import { StrategyConfig, enforceSingleHighPriority } from './strategies';
import { scannerBridge } from './scannerBridge';
 
export class ScannerLogicManager {
  private strategies: StrategyConfig[] = [];
  private activeHighId: string | null = null;

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
   * Select a new strategy to be the single 'HIGH' priority winner.
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
