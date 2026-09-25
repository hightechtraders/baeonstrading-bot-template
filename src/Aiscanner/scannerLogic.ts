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
    return [...this.strategies];
  }

  private getTicksForAsset(
    asset: string,
    ticksBuffer: Record<string, number[]>,
    symbolMap: Record<string, string>
  ): number[] {
    if (!asset || !ticksBuffer) return [];

    const cleanAsset = asset.trim();
    const cleanAssetUpper = cleanAsset.toUpperCase();

    const mappedSymbol = symbolMap[asset] || symbolMap[cleanAsset] || symbolMap[cleanAssetUpper];
    if (mappedSymbol && ticksBuffer[mappedSymbol]?.length) {
      return ticksBuffer[mappedSymbol];
    }

    const rawSymbol = ASSET_TO_SYMBOL[asset] || ASSET_TO_SYMBOL[cleanAsset] || ASSET_TO_SYMBOL[cleanAssetUpper];
    if (rawSymbol && ticksBuffer[rawSymbol]?.length) {
      return ticksBuffer[rawSymbol];
    }

    if (ticksBuffer[asset]?.length) return ticksBuffer[asset];
    if (ticksBuffer[cleanAssetUpper]?.length) return ticksBuffer[cleanAssetUpper];

    const matchedKey = Object.keys(ticksBuffer).find((key) => {
      const k = key.replace(/_/g, ' ').toUpperCase();
      const a = cleanAssetUpper.replace(/_/g, ' ');
      return k === a || k.includes(a) || a.includes(k);
    });

    return matchedKey ? ticksBuffer[matchedKey] : [];
  }

  public evaluateAndProcessTicks(
    ticksBuffer: Record<string, number[]>,
    symbolMap: Record<string, string> = {},
    skipSorting: boolean = false,
    activeExpandedId: string | number | null = null
  ): StrategyConfig[] {
    if (!this.strategies.length || !ticksBuffer) return this.strategies;

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

    // 2. Lock priority: If a card is active/expanded, keep HIGH priority locked to it
    if (activeExpandedId !== null && activeExpandedId !== undefined) {
      this.activeHighId = String(activeExpandedId);
    } else {
      const rawWinner = [...evaluated].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
      if (rawWinner) {
        if (!this.activeHighId) {
          this.activeHighId = rawWinner.id;
          this.lastSwitchTime = now;
        } else if (rawWinner.id !== this.activeHighId) {
          if (now - this.lastSwitchTime >= this.MIN_HOLD_DURATION_MS) {
            this.activeHighId = rawWinner.id;
            this.lastSwitchTime = now;
          }
        }
      }
    }

    // 3. Format with single HIGH priority enforced
    const formatted = enforceSingleHighPriority(evaluated, this.activeHighId || undefined);

    // 4. Freeze ordering while user is editing an expanded card
    if (skipSorting) {
      const currentOrderMap = new Map(this.strategies.map((s, index) => [s.id, index]));
      this.strategies = [...formatted].sort((a, b) => {
        return (currentOrderMap.get(a.id) ?? 0) - (currentOrderMap.get(b.id) ?? 0);
      });
      return [...this.strategies];
    }

    // 5. Default sorting by priority and confidence when no card is expanded
    this.strategies = [...formatted].sort((a, b) => {
      if (a.priority === 'HIGH') return -1;
      if (b.priority === 'HIGH') return 1;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    return [...this.strategies];
  }

  public setHighPriority(strategyId: string): StrategyConfig[] {
    return this.setStrategies(this.strategies, strategyId);
  }

  public updateStrategyParams(
    strategyId: string,
    updates: Partial<Pick<StrategyConfig, 'stake' | 'stopLoss' | 'takeProfit'>>
  ): StrategyConfig[] {
    this.strategies = this.strategies.map((strat) => {
      if (strat.id === strategyId) {
        return { ...strat, ...updates };
      }
      return strat;
    });

    return [...this.strategies];
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
    return [...this.strategies];
  }
}

export const scannerLogic = new ScannerLogicManager();
