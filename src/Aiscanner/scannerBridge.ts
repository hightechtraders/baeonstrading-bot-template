// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      
  durationUnit?: string;   
}

export class ScannerBridge {
  /**
   * Translates strategy market labels or asset codes into strict Deriv API Codes.
   */
  private static translateSymbol(rawSymbol: string): string {
    if (!rawSymbol || typeof rawSymbol !== 'string') return '1HZ100V';
    
    const clean = rawSymbol
      .toUpperCase()
      .replace(/INDEX/g, '')
      .replace(/[\s\(\)]+/g, '');
    
    const symbolMap: Record<string, string> = {
      // 1-Second (1s) High-Speed Series
      'VOLATILITY101S':  '1HZ10V',
      'VOLATILITY501S': '1HZ50V',
      'VOLATILITY751S': '1HZ75V',
      'VOLATILITY1001S':'1HZ100V',
      // Standard Volatility Indices
      'VOLATILITY10':     'R_10',
      'VOLATILITY25':     'R_25',
      'VOLATILITY50':     'R_50',
      'VOLATILITY75':     'R_75',
      'VOLATILITY100':    'R_100',
    };

    return symbolMap[clean] || '1HZ100V';
  }

  /**
   * Safe parameter injector targeting the quick strategy store.
   */
  public static injectViaStore(payload: AIScannerPayload): boolean {
    const rootStore = (window as any).derivBotAppStore;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    console.log(`[ScannerBridge] Mapping input "${payload.symbol}" -> Verified API Code: "${strictDerivSymbol}"`);

    // 1. Mutate the quick strategy store safely if available
    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('amount', payload.stake);
        }
        
        const mockFormData = {
          symbol: strictDerivSymbol, 
          durationtype: payload.durationUnit || 't', 
          duration: payload.duration,
          stake: payload.stake,
          amount: payload.stake,
          tradetype: payload.tradeType || 'rise_fall',
          type: payload.tradeType || 'rise_fall'
        };

        if (typeof quickStrategy.onSubmit === 'function') {
          quickStrategy.onSubmit(mockFormData);
        } else if (typeof quickStrategy.createStrategy === 'function') {
          quickStrategy.createStrategy(mockFormData);
        }
      } catch (error) {
        console.warn("[ScannerBridge] Quick strategy store method failed:", error);
      }
    }

    // 2. Safe Canvas Sweep with existence checks
    setTimeout(() => {
      try {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.mainWorkspace;

        if (workspace && typeof workspace.getAllBlocks === 'function') {
          const blocks = workspace.getAllBlocks(false);
          if (Array.isArray(blocks)) {
            blocks.forEach((block: any) => {
              if (block && typeof block.getField === 'function') {
                const symbolField = block.getField('SYMBOL_LIST');
                if (symbolField) {
                  if (symbolField.menuGenerator_ && Array.isArray(symbolField.menuGenerator_)) {
                    const exists = symbolField.menuGenerator_.some((opt: any) => opt[1] === strictDerivSymbol || opt[0] === strictDerivSymbol);
                    if (!exists) {
                      symbolField.menuGenerator_.push([strictDerivSymbol, strictDerivSymbol]);
                    }
                  }
                  symbolField.setValue(strictDerivSymbol);
                }
              }
            });
            if (typeof workspace.render === 'function') {
              workspace.render();
            }
          }
        }
      } catch (e) {
        console.warn("[ScannerBridge] Canvas sync warning:", e);
      }
    }, 150);

    return true;
  }

  /**
   * Extracts values strictly from strategy market properties, ignoring text labels like names.
   */
  public static loadStrategyToWorkspace(strategy: any, options: { stake?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    const rawSymbol = 
      options?.symbol || 
      strategy?.market || 
      strategy?.symbol || 
      '1HZ100V'; // Excludes strategy.name to avoid treating titles like "High-Frequency Scalper" as symbols

    const payload: AIScannerPayload = {
      symbol: rawSymbol,
      stake: options?.stake || strategy?.recommendedStake || strategy?.stake || 10,
      duration: options?.duration || strategy?.duration || 5,
      tradeType: options?.contractType || strategy?.contractType || 'rise_fall',
      durationUnit: options?.durationUnit || 't'
    };

    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
