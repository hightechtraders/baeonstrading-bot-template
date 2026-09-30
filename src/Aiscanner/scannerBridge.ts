// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      // Strategy direction: 'UP' / 'DOWN' or 'rise' / 'fall'
  durationUnit?: string;   
}

export class ScannerBridge {
  private static translateSymbol(rawSymbol: string): string {
    if (!rawSymbol || typeof rawSymbol !== 'string') return '1HZ100V';
    
    const clean = rawSymbol
      .toUpperCase()
      .replace(/INDEX/g, '')
      .replace(/[\s\(\)]+/g, '');
    
    const symbolMap: Record<string, string> = {
      'VOLATILITY101S':  '1HZ10V',
      'VOLATILITY501S': '1HZ50V',
      'VOLATILITY751S': '1HZ75V',
      'VOLATILITY1001S':'1HZ100V',
      'VOLATILITY10':     'R_10',
      'VOLATILITY25':     'R_25',
      'VOLATILITY50':     'R_50',
      'VOLATILITY75':     'R_75',
      'VOLATILITY100':    'R_100',
    };

    return symbolMap[clean] || '1HZ100V';
  }

  public static injectViaStore(payload: AIScannerPayload): boolean {
    const rootStore = (window as any).derivBotAppStore;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    // Map tradeType/direction to store terms ('rise' / 'fall') and UI canvas terms ('Rise' / 'Fall')
    const rawTradeType = (payload.tradeType || 'rise').toLowerCase();
    const isFall = rawTradeType.includes('down') || rawTradeType.includes('put') || rawTradeType.includes('fall');
    const derivPurchaseType = isFall ? 'fall' : 'rise';
    const blocklyTradeType = isFall ? 'Fall' : 'Rise'; // Blockly canvas requires title-case

    console.log(`[ScannerBridge] Volatility locked to: "${strictDerivSymbol}", Purchase Condition Target: "${blocklyTradeType}"`);

    // 1. Mutate the quick strategy store with the working volatility and updated trade type
    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('amount', payload.stake);
          quickStrategy.setValue('trade_type', derivPurchaseType);
        }
        
        const mockFormData = {
          symbol: strictDerivSymbol, 
          durationtype: payload.durationUnit || 't', 
          duration: payload.duration,
          stake: payload.stake,
          amount: payload.stake,
          tradetype: 'rise_fall',
          type: derivPurchaseType
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

    // 2. Safe Canvas Sweep: Update Block #2 (Purchase Conditions) using capitalized option values
    setTimeout(() => {
      try {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.mainWorkspace;

        if (workspace && typeof workspace.getAllBlocks === 'function') {
          const blocks = workspace.getAllBlocks(false);
          if (Array.isArray(blocks)) {
            blocks.forEach((block: any) => {
              if (block && typeof block.getField === 'function') {
                // Keep your working symbol list assignment untouched
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

                // Target Block #2 Purchase Condition field
                const purchaseField = block.getField('PURCHASE_LIST') || block.getField('PURCHASE_TYPE');
                if (purchaseField && typeof purchaseField.setValue === 'function') {
                  purchaseField.setValue(blocklyTradeType);
                }
              }

              // Target purchase blocks explicitly
              if (block.type === 'purchase' || block.type?.includes('purchase')) {
                const typeField = block.getField('PURCHASE_LIST');
                if (typeField && typeof typeField.setValue === 'function') {
                  typeField.setValue(blocklyTradeType);
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

  public static loadStrategyToWorkspace(strategy: any, options: { stake?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    const rawSymbol = 
      options?.symbol || 
      strategy?.market || 
      strategy?.symbol || 
      '1HZ100V'; 

    const strategyDirection = options?.contractType || strategy?.direction || strategy?.tradeType || 'rise';

    const payload: AIScannerPayload = {
      symbol: rawSymbol,
      stake: options?.stake || strategy?.recommendedStake || strategy?.stake || 10,
      duration: options?.duration || strategy?.duration || 5,
      tradeType: strategyDirection,
      durationUnit: 't'
    };

    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
