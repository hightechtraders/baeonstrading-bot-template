// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      
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
    
    const rawTradeType = (payload.tradeType || 'rise').toLowerCase();
    const isFall = rawTradeType.includes('down') || rawTradeType.includes('put') || rawTradeType.includes('fall');
    
    // Explicit mappings for Deriv Quick Strategy engine
    const storeContractType = isFall ? 'PUT' : 'CALL';
    const storeType = isFall ? 'fall' : 'rise';

    console.log(`[ScannerBridge] Processing Strategy -> Symbol: ${strictDerivSymbol} | Direction: ${storeContractType}`);

    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('amount', payload.stake);
          quickStrategy.setValue('contract_type', storeContractType);
          quickStrategy.setValue('type', storeType);
        }
        
        const mockFormData = {
          symbol: strictDerivSymbol, 
          durationtype: payload.durationUnit || 't', 
          duration: payload.duration,
          stake: payload.stake,
          amount: payload.stake,
          tradetype: 'rise_fall',
          contract_type: storeContractType,
          type: storeType
        };

        const submitAction = quickStrategy.onSubmit || quickStrategy.createStrategy;
        if (typeof submitAction === 'function') {
          Promise.resolve(submitAction.call(quickStrategy, mockFormData)).catch(err => {
            console.warn("[ScannerBridge] Store submission caught warning:", err);
          });
        }
      } catch (error) {
        console.warn("[ScannerBridge] Quick strategy store method failed:", error);
      }
    }

    // Delayed deep sweep to override any default reset back to Rise
    setTimeout(() => {
      try {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.mainWorkspace || Blockly?.derivWorkspace;

        if (workspace && typeof workspace.getAllBlocks === 'function') {
          const blocks = workspace.getAllBlocks(false);
          if (Array.isArray(blocks)) {
            blocks.forEach((block: any) => {
              if (!block) return;

              // 1. Update Symbol Fields
              if (typeof block.getField === 'function') {
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

              // 2. Force-update Purchase Condition blocks (Rise / Fall / Put / Call)
              if (block.type === 'purchase' || block.type?.includes('purchase') || block.type === 'trade_definition_purchase') {
                const fieldNames = ['PURCHASE_LIST', 'PURCHASE_TYPE', 'PURCHASE_CONDITIONS_LIST', 'CONTRACT_TYPE'];
                fieldNames.forEach(name => {
                  const field = block.getField(name);
                  if (field && typeof field.setValue === 'function') {
                    const options = typeof field.getOptions === 'function' ? field.getOptions() : [];
                    // Look for an option matching the target direction
                    const targetMatch = options.find((opt: any) => {
                      const label = String(opt[0] || '').toLowerCase();
                      const val = String(opt[1] || '').toLowerCase();
                      if (isFall) {
                        return label.includes('fall') || label.includes('put') || val.includes('fall') || val.includes('put');
                      } else {
                        return label.includes('rise') || label.includes('call') || val.includes('rise') || val.includes('call');
                      }
                    });

                    if (targetMatch) {
                      field.setValue(targetMatch[1]);
                    } else {
                      field.setValue(isFall ? 'Fall' : 'Rise');
                    }
                  }
                });
              }
            });

            if (typeof workspace.render === 'function') {
              workspace.render();
            }
          }
        }
      } catch (e) {
        console.warn("[ScannerBridge] Final sync pass warning:", e);
      }
    }, 350);

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
      durationUnit: options?.durationUnit || 't'
    };

    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
