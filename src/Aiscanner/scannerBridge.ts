// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string; // e.g., '1HZ100V' for Volatility 100 (1s) Index
  tradeType?: string;
}

export class ScannerBridge {
  /**
   * Safe parameter injector targeting the native quick_strategy state engine.
   * Leverages the internal reactive form state and updates the block tree visually.
   */
  public static injectViaStore(payload: AIScannerPayload): boolean {
    // 1. Fetch the central state manager bound within your RootStore constructor
    const rootStore = (window as any).derivBotAppStore;
    
    if (!rootStore) {
      console.warn("[ScannerBridge] Active root state model context was not found on the window object.");
      return false;
    }

    try {
      // 2. Safely isolate your target quick_strategy sub-store
      const quickStrategy = rootStore.quick_strategy;
      if (!quickStrategy) {
        console.error("[ScannerBridge] Target sub-store path 'quick_strategy' could not be resolved.");
        return false;
      }

      // 3. Mutate the framework configuration states directly[cite: 7]
      if (typeof quickStrategy.setValue === 'function') {
        quickStrategy.setValue('duration', payload.duration);
        quickStrategy.setValue('amount', payload.stake);
        quickStrategy.setValue('symbol', payload.symbol);
        if (payload.tradeType) {
          quickStrategy.setValue('trade_type', payload.tradeType);
        }
      } else {
        // Fallback: Direct field mutations targeting the observable properties[cite: 7]
        if ('duration' in quickStrategy) quickStrategy.duration = payload.duration;
        if ('amount' in quickStrategy) quickStrategy.amount = payload.stake;
        if ('stake' in quickStrategy) quickStrategy.stake = payload.stake;
        if ('symbol' in quickStrategy) quickStrategy.symbol = payload.symbol;
        if ('selected_symbol' in quickStrategy) quickStrategy.selected_symbol = payload.symbol;
      }

      // 4. Force the layout configuration compiler to parse data changes into blocks[cite: 7]
      if (typeof quickStrategy.createStrategy === 'function') {
        quickStrategy.createStrategy();
      } else if (typeof quickStrategy.onSubmit === 'function') {
        quickStrategy.onSubmit();
      } else {
        // Canvas engine block repaint fallback[cite: 7]
        const workspace = (window as any).Blockly?.mainWorkspace;
        if (workspace && typeof workspace.render === 'function') {
          workspace.render();
        }
      }

      console.log(`[ScannerBridge] Successfully synchronized dynamic parameters: ${payload.symbol}`);
      return true;
    } catch (error) {
      console.error("[ScannerBridge] Critical internal state parameter mapping failure:", error);
      return false;
    }
  }

  // Wrapper for strategies.ts compatibility
  public static loadStrategyToWorkspace(strategy: any, options: { stake?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    const payload: AIScannerPayload = {
      symbol: options.symbol || strategy.symbol || '1HZ75',
      stake: options.stake || strategy.recommendedStake || 10,
      duration: options.duration || 5,
      tradeType: options.contractType || 'rise_fall'
    };
    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
