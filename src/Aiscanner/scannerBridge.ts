// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      
  durationUnit?: string;   
}

export class ScannerBridge {
  private static activeListener: any = null;
  private static isScannerActive: boolean = false; // Flag to control activation

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
    // Activate scanner mode since user explicitly triggered an AI scanner action
    ScannerBridge.isScannerActive = true;

    const rootStore = (window as any).derivBotAppStore;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    const rawTradeType = (payload.tradeType || 'rise').toLowerCase();
    const isFall = rawTradeType.includes('down') || rawTradeType.includes('put') || rawTradeType.includes('fall');
    
    const storeContractType = isFall ? 'PUT' : 'CALL';
    const storeType = isFall ? 'fall' : 'rise';
    const martingaleMultiplier = 2.4;

    console.log(`[ScannerBridge] Activating Scanner Strategy -> Symbol: ${strictDerivSymbol} | Direction: ${storeContractType} | Martingale: ${martingaleMultiplier}`);

    // 1. Update the Quick Strategy Store State
    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('amount', payload.stake);
          quickStrategy.setValue('contract_type', storeContractType);
          quickStrategy.setValue('type', storeType);
          quickStrategy.setValue('size', martingaleMultiplier);
        }
        
        const mockFormData = {
          symbol: strictDerivSymbol, 
          durationtype: payload.durationUnit || 't', 
          duration: payload.duration,
          stake: payload.stake,
          amount: payload.stake,
          tradetype: 'rise_fall',
          contract_type: storeContractType,
          type: storeType,
          size: martingaleMultiplier
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

    // 2. Helper function to apply field values directly on the blocks (Only runs if scanner is active)
    const applyBlockMutations = () => {
      if (!ScannerBridge.isScannerActive) return; // Skip if scanner hasn't been triggered yet

      try {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.mainWorkspace || Blockly?.derivWorkspace;

        if (workspace && typeof workspace.getAllBlocks === 'function') {
          const blocks = workspace.getAllBlocks(false);
          if (Array.isArray(blocks)) {
            let updated = false;

            blocks.forEach((block: any) => {
              if (!block) return;

              // Symbol Update
              if (typeof block.getField === 'function') {
                const symbolField = block.getField('SYMBOL_LIST');
                if (symbolField && symbolField.getValue() !== strictDerivSymbol) {
                  if (symbolField.menuGenerator_ && Array.isArray(symbolField.menuGenerator_)) {
                    const exists = symbolField.menuGenerator_.some((opt: any) => opt[1] === strictDerivSymbol || opt[0] === strictDerivSymbol);
                    if (!exists) {
                      symbolField.menuGenerator_.push([strictDerivSymbol, strictDerivSymbol]);
                    }
                  }
                  symbolField.setValue(strictDerivSymbol);
                  updated = true;
                }
              }

              // Purchase Condition Enforcement
              if (block.type === 'purchase' || block.type?.includes('purchase') || block.type === 'trade_definition_purchase') {
                const fieldNames = ['PURCHASE_LIST', 'PURCHASE_TYPE', 'PURCHASE_CONDITIONS_LIST', 'CONTRACT_TYPE'];
                fieldNames.forEach(name => {
                  const field = block.getField(name);
                  if (field && typeof field.setValue === 'function') {
                    const options = typeof field.getOptions === 'function' ? field.getOptions() : [];
                    const targetMatch = options.find((opt: any) => {
                      const label = String(opt[0] || '').toLowerCase();
                      const val = String(opt[1] || '').toLowerCase();
                      if (isFall) {
                        return label.includes('fall') || label.includes('put') || val.includes('fall') || val.includes('put');
                      } else {
                        return label.includes('rise') || label.includes('call') || val.includes('rise') || val.includes('call');
                      }
                    });

                    const desiredVal = targetMatch ? targetMatch[1] : (isFall ? 'Fall' : 'Rise');
                    if (field.getValue() !== desiredVal) {
                      field.setValue(desiredVal);
                      updated = true;
                    }
                  }
                });
              }

              // Martingale Multiplier Enforcement (2.4)
              if (block.type === 'trade_again' || block.type?.includes('restart') || block.type?.includes('martingale')) {
                block.inputList?.forEach((input: any) => {
                  input.fieldRow?.forEach((field: any) => {
                    if (field && typeof field.setValue === 'function' && (field.name === 'VALUE' || field.name === 'MULTIPLIER' || field.EDITABLE)) {
                      const val = Number(field.getValue());
                      if (val === 3 || isNaN(val) || field.getValue() === '3') {
                        field.setValue(String(martingaleMultiplier));
                        updated = true;
                      }
                    }
                  });
                });
              }
            });

            if (updated && typeof workspace.render === 'function') {
              workspace.render();
            }
          }
        }
      } catch (e) {
        // silent
      }
    };

    // 3. Bind directly to Blockly workspace events only after scanner activation
    try {
      const Blockly = (window as any).Blockly;
      const workspace = Blockly?.mainWorkspace || Blockly?.derivWorkspace;
      
      if (workspace && workspace.addChangeListener) {
        if (ScannerBridge.activeListener) {
          workspace.removeChangeListener(ScannerBridge.activeListener);
        }
        
        ScannerBridge.activeListener = (event: any) => {
          if (!ScannerBridge.isScannerActive) return;
          if (event && (event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.FINISHED_LOADING || event.type === Blockly.Events.UI)) {
            applyBlockMutations();
          }
        };
        workspace.addChangeListener(ScannerBridge.activeListener);
      }
    } catch (err) {
      console.warn("[ScannerBridge] Event listener binding warning:", err);
    }

    // 4. Run immediate bursts to apply scanner parameters
    applyBlockMutations();
    setTimeout(applyBlockMutations, 100);
    setTimeout(applyBlockMutations, 300);
    setTimeout(applyBlockMutations, 600);
    setTimeout(applyBlockMutations, 1000);

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
