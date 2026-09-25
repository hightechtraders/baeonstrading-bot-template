// src/Aiscanner/scannerLogic.ts
import { StrategyConfig, enforceSingleHighPriority, evaluateStrategySignal } from './strategies';
import { scannerBridge } from './scannerBridge';
import { ASSET_TO_SYMBOL } from './useDerivTicks';

export class ScannerLogicManager {
  private strategies: StrategyConfig[] = [];
  private activeHighId: string | null = null;
  private lastSwitchTime = 0;
  private readonly MIN_HOLD_DURATION_MS = 2000;

  constructor(initialStrategies: StrategyConfig[] = []) {
    if (initialStrategies.length > 0) {
      this.setStrategies(initialStrategies);
    }
  }

  public setStrategies(strategies: StrategyConfig[], targetHighId?: string): StrategyConfig[] {
    const defaultHigh = targetHighId || this.activeHighId || strategies[0]?.id || null;
    this.strategies = enforceSingleHighPriority(strategies, defaultHigh || undefined);
    this.activeHighId = defaultHigh;
    return this.strategies;
  }

  /**
   * Safe lookup for symbol tick arrays from ticksBuffer
   */
  private getTicksForAsset(
    asset: string,
    ticksBuffer: Record<string, number[]>,
    symbolMap: Record<string, string>
  ): number[] {
    if (!asset || !ticksBuffer) return [];

    // 1. Explicit symbol map override
    const mappedSymbol = symbolMap[asset];
    if (mappedSymbol && ticksBuffer[mappedSymbol]?.length > 0) {
      return ticksBuffer[mappedSymbol];
    }

    // 2. ASSET_TO_SYMBOL lookup
    const rawSymbol = ASSET_TO_SYMBOL[asset] || ASSET_TO_SYMBOL[asset.trim()];
    if (rawSymbol && ticksBuffer[rawSymbol]?.length > 0) {
      return ticksBuffer[rawSymbol];
    }

    // 3. Direct key match
    if (ticksBuffer[asset]?.length > 0) {
      return ticksBuffer[asset];
    }

    // 4. Flexible key match
    const cleanAsset = asset.replace(/_/g, ' ').toLowerCase();
    const matchedKey = Object.keys(ticksBuffer).find((key) => {
      const cleanKey = key.replace(/_/g, ' ').toLowerCase();
      return cleanKey === cleanAsset || cleanKey.includes(cleanAsset);
    });

    return matchedKey ? ticksBuffer[matchedKey] : [];
  }

  public evaluateAndProcessTicks(
    ticksBuffer: Record<string, number[]>,
    symbolMap: Record<string, string> = {}
  ): StrategyConfig[] {
    const now = Date.now();

    // 1. Calculate indicators for each strategy
    const evaluated = this.strategies.map((strat) => {
      const ticks = this.getTicksForAsset(strat.asset, ticksBuffer, symbolMap);
      const signal = evaluateStrategySignal(strat, ticks);

      return {
        ...strat,
        score: signal.score,
        confidence: signal.confidence,
        direction: signal.direction,
      };
    });

    // 2. Locate top confidence strategy
    const rawWinner = [...evaluated].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];

    // 3. Apply hold lock timer before changing active priority
    if (rawWinner && rawWinner.id !== this.activeHighId) {
      if (now - this.lastSwitchTime >= this.MIN_HOLD_DURATION_MS) {
        this.activeHighId = rawWinner.id;
        this.lastSwitchTime = now;
      }
    }

    if (!this.activeHighId && evaluated.length > 0) {
      this.activeHighId = evaluated[0].id;
    }

    // 4. Update internal strategy list with enforced HIGH priority
    const formatted = enforceSingleHighPriority(evaluated, this.activeHighId || undefined);
    
    // 5. Sort array with HIGH priority first, followed by confidence descending
    this.strategies = [...formatted].sort((a, b) => {
      if (a.priority === 'HIGH') return -1;
      if (b.priority === 'HIGH') return 1;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    return this.strategies;
  }

  public setHighPriority(strategyId: string): StrategyConfig[] {
    return this.setStrategies(this.strategies, strategyId);
  }

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

  public getStrategies(): StrategyConfig[] {
    return this.strategies;
  }
}

export const scannerLogic = new ScannerLogicManager();
