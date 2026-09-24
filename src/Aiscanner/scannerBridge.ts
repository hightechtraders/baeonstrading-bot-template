// src/Aiscanner/scannerBridge.ts

import { StrategyConfig, generateDBotXml, enforceSingleHighPriority } from './strategies';

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
              if (strat.asset === asset) {
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
    const history = this.tickStore.get(asset) || [];
    history.push(price);
    if (history.length > 50) history.shift();
    this.tickStore.set(asset, history);

    this.worker?.postMessage({
      type: 'TICK_UPDATE',
      payload: { asset, ticks: history, strategies },
    });
  }

  public loadStrategyToBot(strategy: StrategyConfig): boolean {
    if (strategy.priority !== 'HIGH') {
      console.warn(`[ScannerBridge] Strategy "${strategy.name}" is not HIGH priority. Import denied.`);
      return false;
    }

    const windowBlockly = (window as any).Blockly;
    const workspace = windowBlockly?.mainWorkspace || windowBlockly?.Workspace?.getByContainer?.('board');

    if (!workspace) {
      console.error('[ScannerBridge] Deriv Blockly workspace not found.');
      return false;
    }

    try {
      const xmlString = generateDBotXml(strategy);
      const xmlDom = windowBlockly.Xml.textToDom(xmlString);

      workspace.clear();
      windowBlockly.Xml.domToWorkspace(xmlDom, workspace);
      workspace.render();

      window.dispatchEvent(
        new CustomEvent('dbot:strategy-imported', { detail: strategy })
      );

      console.log(`[ScannerBridge] Imported bot strategy successfully: ${strategy.name}`);
      return true;
    } catch (error) {
      console.error('[ScannerBridge] Failed to load strategy XML into Blockly:', error);
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
