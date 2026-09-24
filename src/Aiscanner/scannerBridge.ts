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

    try {
      const xmlString = generateDBotXml(strategy);

      // Ensure user is on Bot Builder tab
      if (window.location.hash !== '#bot_builder') {
        window.location.hash = '#bot_builder';
      }

      // 1. Try DBot MobX Store integration (Standard Deriv DBot Architecture)
      const derivStore = (window as any).Blockly?.derivWorkspace || (window as any).store || (window as any).root_store;
      const loadModalStore = derivStore?.load_modal || derivStore?.dbot?.load_modal;

      if (loadModalStore && typeof loadModalStore.loadStrategy === 'function') {
        loadModalStore.loadStrategy(xmlString);
        console.log(`[ScannerBridge] Strategy loaded via DBot MobX store: ${strategy.name}`);
        return true;
      }

      // 2. Try window event dispatcher fallback
      window.dispatchEvent(
        new CustomEvent('dbot:import-xml', {
          detail: { xmlString, strategy },
        })
      );

      // 3. Fallback to Direct Blockly API Injection
      setTimeout(() => {
        const windowBlockly = (window as any).Blockly;
        if (!windowBlockly) return;

        // Find active workspace instance
        const workspace =
          windowBlockly.mainWorkspace ||
          windowBlockly.derivWorkspace ||
          (windowBlockly.Workspace && windowBlockly.Workspace.getByContainer && windowBlockly.Workspace.getByContainer('board')) ||
          (window as any).dbot?.workspace;

        if (workspace && windowBlockly.Xml) {
          const xmlDom = windowBlockly.Xml.textToDom(xmlString);
          workspace.clear();
          windowBlockly.Xml.domToWorkspace(xmlDom, workspace);
          if (typeof workspace.render === 'function') {
            workspace.render();
          }
        }
      }, 100);

      console.log(`[ScannerBridge] Strategy import requested: ${strategy.name}`);
      return true;
    } catch (error) {
      console.error('[ScannerBridge] Failed to load strategy XML:', error);
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
