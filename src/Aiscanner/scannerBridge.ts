// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          // e.g., '1HZ100V'
  tradeType?: string;      // e.g., 'rise_fall'
  durationUnit?: string;   // e.g., 't'
}

export class ScannerBridge {
  public static injectViaStore(payload: AIScannerPayload): boolean {
    const workspace = (window as any).Blockly?.mainWorkspace;
    
    if (!workspace) {
      console.error("[ScannerBridge] Blockly workspace not found.");
      return false;
    }

    try {
      let updated = false;
      const blocks = workspace.getAllBlocks(false);

      // Iterate through active blocks to find trade definition fields and mutate them live
      blocks.forEach((block: any) => {
        // Update Symbol
        if (block.type === 'trade_definition_market' || block.getField('SYMBOL_LIST')) {
          const symbolField = block.getField('SYMBOL_LIST');
          if (symbolField) {
            symbolField.setValue(payload.symbol);
            updated = true;
          }
        }

        // Update Stake & Duration options
        if (block.type === 'trade_definition_options' || block.getField('AMOUNT') || block.getField('DURATION')) {
          const amountField = block.getField('AMOUNT');
          if (amountField) {
            // Some versions use shadow blocks or direct values
            amountField.setValue?.(payload.stake.toString());
            updated = true;
          }
          const durationField = block.getField('DURATION');
          if (durationField) {
            durationField.setValue?.(payload.duration.toString());
            updated = true;
          }
        }
      });

      // If fields weren't found on existing blocks, fallback to the root store quick strategy trigger
      if (!updated) {
        const rootStore = (window as any).derivBotAppStore;
        if (rootStore?.quick_strategy) {
          const qs = rootStore.quick_strategy;
          if (typeof qs.setValue === 'function') {
            qs.setValue('symbol', payload.symbol);
            qs.setValue('amount', payload.stake);
            qs.setValue('duration', payload.duration);
            updated = true;
          }
        }
      }

      workspace.render();
      console.log(`[ScannerBridge] Successfully updated workspace parameters for: ${payload.symbol}`);
      return updated;
    } catch (error) {
      console.error("[ScannerBridge] Failed to update workspace blocks:", error);
      return false;
    }
  }

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
