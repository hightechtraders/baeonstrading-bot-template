// src/Aiscanner/scannerBridge.ts

import { StrategyConfig, generateDBotXml, enforceSingleHighPriority } from './strategies';

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
              // Match exact asset name or symbol mapping
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
      const xmlString = generateDBotXml(strategy);

      // 1. Route to Bot Builder tab
      if (window.location.hash !== '#bot_builder') {
        window.location.hash = '#bot_builder';
      }

      // 2. Dispatch custom event for template listeners
      window.dispatchEvent(
        new CustomEvent('dbot:import-xml', {
          detail: { xmlString, strategy },
        })
      );

      // 3. Inject into DBot MobX stores or Blockly Workspace
      setTimeout(() => {
        const win = window as any;
        const dbotStore = win.store || win.root_store || win.dbot || win.Blockly?.derivWorkspace;

        // DBot xml_onload MobX Store
        if (dbotStore?.xml_onload?.loadXmlString) {
          dbotStore.xml_onload.loadXmlString(xmlString);
          console.log(`[ScannerBridge] Loaded XML via xml_onload: ${strategy.name}`);
          return;
        }

        // DBot load_modal MobX Store
        if (dbotStore?.load_modal?.loadStrategyOnUnload) {
          dbotStore.load_modal.loadStrategyOnUnload(xmlString);
          console.log(`[ScannerBridge] Loaded XML via load_modal: ${strategy.name}`);
          return;
        }

        // Direct Blockly Workspace Injection
        const windowBlockly = win.Blockly;
        if (windowBlockly?.Xml) {
          const workspace =
            windowBlockly.mainWorkspace ||
            windowBlockly.derivWorkspace ||
            (windowBlockly.Workspace?.getByContainer && windowBlockly.Workspace.getByContainer('board')) ||
            win.dbot?.workspace;

          if (workspace) {
            const xmlDom = windowBlockly.Xml.textToDom(xmlString);
            workspace.clear();
            windowBlockly.Xml.domToWorkspace(xmlDom, workspace);
            if (typeof workspace.cleanUp === 'function') workspace.cleanUp();
            if (typeof workspace.render === 'function') workspace.render();
            console.log(`[ScannerBridge] Directly rendered XML to Blockly canvas: ${strategy.name}`);
          }
        }
      }, 150);

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
