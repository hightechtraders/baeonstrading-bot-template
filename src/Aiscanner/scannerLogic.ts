// src/Aiscanner/scannerLogic.ts
import { StrategyConfig, enforceSingleHighPriority, evaluateStrategySignal, applyStrategyToWorkspace } from './strategies';
import { ASSET_TO_SYMBOL, resolveSymbol } from './useDerivTicks';

export const isTradeProfitable = (
  confidence: number,
  payoutRatio: number = 0.891,
  safetyMargin: number = 3
): boolean => {
  const breakEvenRate = (1 / (1 + payoutRatio)) * 100;
  return confidence >= breakEvenRate + safetyMargin;
};

export interface CircuitBreakerState {
  triggered: boolean;
  type: 'PROFIT' | 'DRAWDOWN' | null;
  sessionBalance: number;
  triggerTarget: number;
  totalCycles: number;
}

export class ScannerLogicManager {
  private strategies: StrategyConfig[] = [];
  private activeHighId: string | null = null;
  private lastSwitchTime = 0;
  private readonly MIN_HOLD_DURATION_MS = 2000;
  
  // Circuit breaker state management
  private sessionBalance = 0;
  private totalCyclesRun = 0;
  private circuitBreakerState: CircuitBreakerState = {
    triggered: false,
    type: null,
    sessionBalance: 0,
    triggerTarget: 0,
    totalCycles: 0,
  };
  private circuitBreakerListeners: Array<(state: CircuitBreakerState) => void> = [];

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

    const resolvedSym = resolveSymbol(asset);
    if (ticksBuffer[resolvedSym]?.length) {
      return ticksBuffer[resolvedSym];
    }

    if (ticksBuffer[asset]?.length) return ticksBuffer[asset];

    const cleanAsset = asset.trim();
    const cleanAssetUpper = cleanAsset.toUpperCase();

    const mappedSymbol = symbolMap[asset] || symbolMap[cleanAsset] || symbolMap[cleanAssetUpper];
    if (mappedSymbol && ticksBuffer[mappedSymbol]?.length) {
      return ticksBuffer[mappedSymbol];
    }

    return [];
  }

  public evaluateAndProcessTicks(
    ticksBuffer: Record<string, number[]>,
    symbolMap: Record<string, string> = {},
    skipSorting: boolean = false,
    activeExpandedId: string | number | null = null
  ): StrategyConfig[] {
    if (!this.strategies.length || !ticksBuffer) return this.strategies;

    // If a circuit breaker has already tripped, halt processing new cycles
    if (this.circuitBreakerState.triggered) {
      return this.strategies;
    }

    const now = Date.now();
    this.totalCyclesRun += 1;

    const evaluated = this.strategies.map((strat) => {
      if (activeExpandedId !== null && String(strat.id) === String(activeExpandedId)) {
        return strat;
      }

      // Automatically looks up live ticks across ALL configured symbols in ASSET_TO_SYMBOL
      const ticks = this.getTicksForAsset(strat.asset, ticksBuffer, symbolMap);
      const signal = evaluateStrategySignal(strat, ticks);
      const satisfiesRisk = isTradeProfitable(signal.confidence);

      // Check for user-defined take profit or stop loss limits on the active strategy
      this.checkCircuitBreakers(strat);

      return {
        ...strat,
        score: signal.score,
        confidence: signal.confidence,
        direction: satisfiesRisk ? signal.direction : 'HOLD',
      };
    });

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

    const formatted = enforceSingleHighPriority(evaluated, this.activeHighId || undefined);

    if (skipSorting) {
      const currentOrderMap = new Map(this.strategies.map((s, index) => [s.id, index]));
      this.strategies = [...formatted].sort((a, b) => {
        return (currentOrderMap.get(a.id) ?? 0) - (currentOrderMap.get(b.id) ?? 0);
      });
      return [...this.strategies];
    }

    this.strategies = [...formatted].sort((a, b) => {
      if (a.priority === 'HIGH') return -1;
      if (b.priority === 'HIGH') return 1;
      return (b.confidence ?? 0) - (a.confidence ?? 0);
    });

    return [...this.strategies];
  }

  public updateSessionBalance(balance: number) {
    this.sessionBalance = balance;
  }

  private checkCircuitBreakers(strategy: StrategyConfig) {
    if (this.circuitBreakerState.triggered) return;

    const takeProfitTarget = strategy.takeProfit ?? 8.0;
    const stopLossTarget = strategy.stopLoss ?? 4.0;

    if (this.sessionBalance >= takeProfitTarget) {
      this.triggerCircuitBreaker({
        triggered: true,
        type: 'PROFIT',
        sessionBalance: this.sessionBalance,
        triggerTarget: takeProfitTarget,
        totalCycles: this.totalCyclesRun,
      });
    } else if (this.sessionBalance <= -Math.abs(stopLossTarget)) {
      this.triggerCircuitBreaker({
        triggered: true,
        type: 'DRAWDOWN',
        sessionBalance: this.sessionBalance,
        triggerTarget: stopLossTarget,
        totalCycles: this.totalCyclesRun,
      });
    }
  }

  private triggerCircuitBreaker(state: CircuitBreakerState) {
    this.circuitBreakerState = state;
    this.circuitBreakerListeners.forEach((listener) => listener(state));
  }

  public subscribeCircuitBreaker(listener: (state: CircuitBreakerState) => void) {
    this.circuitBreakerListeners.push(listener);
    listener(this.circuitBreakerState);
    return () => {
      this.circuitBreakerListeners = this.circuitBreakerListeners.filter((l) => l !== listener);
    };
  }

  public resetCircuitBreaker() {
    this.circuitBreakerState = {
      triggered: false,
      type: null,
      sessionBalance: 0,
      triggerTarget: 0,
      totalCycles: 0,
    };
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
      console.error(`[ScannerLogic] Strategy "${strategy.name}" is not HIGH priority.`);
      return false;
    }

    const activeWorkspace =
      (window as any).Blockly?.getMainWorkspace?.() ||
      (window as any).DBot?.workspace ||
      (window as any).workspace;

    if (!activeWorkspace) {
      console.error('[ScannerLogic] Blockly workspace instance not found on window.');
      return false;
    }

    return applyStrategyToWorkspace(activeWorkspace, strategy);
  }

  public getStrategies(): StrategyConfig[] {
    return [...this.strategies];
  }
}

export const scannerLogic = new ScannerLogicManager();
