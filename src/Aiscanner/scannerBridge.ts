// src/Aiscanner/scannerBridge.ts

import {
  StrategyConfig,
  applyStrategyToWorkspace,
  enforceSingleHighPriority,
} from './strategies';

// Symbol mapper to align raw API symbols with Strategy asset names
const SYMBOL_MAP: Record<string, string> = {
  'R_10': 'Volatility 10',
  'R_25': 'Volatility 25',
  'R_50': 'Volatility 50',
  'R_75': 'Volatility 75',
  'R_100': 'Volatility 100',
  '1HZ100V': 'Volatility 100 (1s)',
  '1HZ25V': 'Volatility 25 (1s)',
};

export class ScannerBridge {
  private worker: Worker | null = null;
  private tickStore: Map<string, number[]> = new Map();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    if (typeof window === 'undefined') return;

    const workerCode = `
      self.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'TICK_UPDATE' || type === 'RUN_SCAN') {
          const { asset, ticks, strategies } = payload;
          const results = [];

          if (strategies && Array.isArray(strategies)) {
            for (const strat of strategies) {
              if (strat.asset === asset || strat.asset.toLowerCase() === asset.toLowerCase()) {
                const recent = ticks ? ticks.slice(-10) : [];
                const gains = recent.slice(1).filter((val, i) => val > recent[i]).length;
                const total = Math.max(recent.length - 1, 1);
                const score = Math.round((gains / total) * 100);
                const direction = score >= 65 ? 'UP' : score <= 35 ? 'DOWN' : 'HOLD';
                const confidence = Math.max(score, 100 - score);

                results.push({
                  strategyId: strat.id,
                  direction,
                  confidence,
                  score,
                  timestamp: Date.now(),
                });
              }
            }
          }

          self.postMessage({ type: 'SCAN_RESULTS', payload: results });
        }
      };
    `;

    try {
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, payload } = event.data;
        if (type === 'SCAN_RESULTS') {
          window.dispatchEvent(
            new CustomEvent('scanner:signals-updated', { detail: payload })
          );
        }
      };
    } catch (err) {
      console.warn('[ScannerBridge] Web Worker initialization fallback:', err);
    }
  }

  public pushTick(asset: string, price: number, strategies: StrategyConfig[]) {
    const normalizedAsset = SYMBOL_MAP[asset] || asset;
    const history = this.tickStore.get(normalizedAsset) || [];
    history.push(price);
    if (history.length > 50) history.shift();
    this.tickStore.set(normalizedAsset, history);

    this.worker?.postMessage({
      type: 'TICK_UPDATE',
      payload: { asset: normalizedAsset, ticks: history, strategies },
    });
  }

  public loadStrategyToBot(strategy: StrategyConfig): boolean {
    if (strategy.priority !== 'HIGH') {
      console.warn(`[ScannerBridge] Strategy "${strategy.name}" is not HIGH priority. Import denied.`);
      return false;
    }

    try {
      // 1. Ensure Bot Builder tab is active
      if (window.location.hash !== '#bot_builder') {
        window.location.hash = '#bot_builder';
      }

      // 2. Safely update active Deriv Blockly Workspace parameters directly
      setTimeout(() => {
        const win = window as any;
        const workspace =
          win.Blockly?.derivWorkspace ||
          win.Blockly?.mainWorkspace ||
          (win.Blockly?.Workspace?.getByContainer && win.Blockly.Workspace.getByContainer('board')) ||
          win.dbot?.workspace;

        if (workspace) {
          const applied = applyStrategyToWorkspace(workspace, strategy);
          if (applied) {
            console.log(`[ScannerBridge] Applied strategy parameters directly to workspace: ${strategy.name}`);
          } else {
            console.warn(`[ScannerBridge] Could not update parameters on workspace blocks for: ${strategy.name}`);
          }
        } else {
          console.error('[ScannerBridge] Active Blockly workspace instance not found.');
        }
      }, 150);

      return true;
    } catch (error) {
      console.error('[ScannerBridge] Failed to load strategy parameters into Blockly:', error);
      return false;
    }
  }

  public setHighPriorityStrategy(
    strategies: StrategyConfig[],
    targetId: string
  ): StrategyConfig[] {
    return enforceSingleHighPriority(strategies, targetId);
  }
}

export const scannerBridge = new ScannerBridge();
