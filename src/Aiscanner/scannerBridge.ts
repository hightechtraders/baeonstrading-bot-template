// ==========================================
// FILE: src/Aiscanner/scannerBridge.ts (CORRECTED)
// ==========================================
import { RiskManager } from './riskManager';
import { ScannerLogic, DerivTickResponse } from './scannerLogic';

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      
  durationUnit?: string;   
  stopLoss?: number;
  takeProfit?: number;
  multiplier?: number;
}

export class ScannerBridge {
  private static isScannerActive: boolean = false; 
  private static scannerLogicInstance = new ScannerLogic();

  static {
    if (typeof window !== 'undefined') {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const isFreshPageLoad = navEntries.length > 0 && navEntries[0].type === 'navigate';

      if (isFreshPageLoad) {
        ScannerBridge.isScannerActive = false;
        try {
          sessionStorage.removeItem('AI_SCANNER_SESSION_ACTIVE');
        } catch (e) {}
      } else {
        const sessionStarted = sessionStorage.getItem('AI_SCANNER_SESSION_ACTIVE');
        ScannerBridge.isScannerActive = !!sessionStarted;
      }
    }
  }

  private static translateSymbol(rawSymbol: string): string {
    if (!rawSymbol || typeof rawSymbol !== 'string') return 'R_10';
    
    const clean = rawSymbol
      .toUpperCase()
      .replace(/INDEX/g, '')
      .replace(/[\s\(\)]+/g, '');
    
    const symbolMap: Record<string, string> = {
      'VOLATILITY101S':   '1HZ10V',
      'VOLATILITY501S':  '1HZ50V',
      'VOLATILITY751S':  '1HZ75V',
      'VOLATILITY1001S': '1HZ100V',
      'VOLATILITY10':     'R_10',
      'VOLATILITY25':     'R_25',
      'VOLATILITY50':     'R_50',
      'VOLATILITY75':     'R_75',
      'VOLATILITY100':    'R_100',
    };

    return symbolMap[clean] || 'R_10';
  }

  public static pushTick(assetName: string, quote: number, strategies?: any[]) {
    const tickPayload: DerivTickResponse = {
      msg_type: 'tick',
      tick: {
        symbol: assetName,
        quote: quote,
        epoch: Date.now(),
        id: Math.random().toString()
      }
    };

    const updatedStrategies = ScannerBridge.scannerLogicInstance.handleIncomingMessage(tickPayload);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-tick-received', {
        detail: { assetName, quote, strategies: updatedStrategies }
      }));
      window.dispatchEvent(new CustomEvent('deriv_scanner_updated', {
        detail: { assetName, quote, strategies: updatedStrategies }
      }));
    }
  }

  public static loadStrategyToWorkspace(strategy: any, options?: any) {
    ScannerBridge.isScannerActive = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('AI_SCANNER_SESSION_ACTIVE', 'true');
    }

    const rawSymbol = options?.symbol || strategy?.symbol || strategy?.market || 'R_10'; 
    const strategyDirection = options?.contractType || strategy?.direction || strategy?.tradeType || 'rise';

    const payload: AIScannerPayload = {
      symbol: rawSymbol,
      stake: 0.35, 
      duration: 5, 
      tradeType: strategyDirection,
      durationUnit: 't', 
      stopLoss: 4.50,     
      takeProfit: 3.00,   
      multiplier: options?.multiplier || strategy?.multiplier || 1.5
    };

    RiskManager.configure(payload.stopLoss, payload.takeProfit);

    const rootStore = (window as any).derivBotAppStore;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    const rawTradeType = (payload.tradeType || 'rise').toLowerCase();
    const isFall = rawTradeType.includes('down') || rawTradeType.includes('put') || rawTradeType.includes('fall');
    
    const storeContractType = isFall ? 'PUT' : 'CALL';
    const storeType = isFall ? 'fall' : 'rise';
    
    const martingaleMultiplier = payload.multiplier || 1.5;

    const applyBlockMutations = () => {
      try {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.mainWorkspace || Blockly?.derivWorkspace;

        if (workspace && typeof workspace.getAllBlocks === 'function') {
          const blocks = workspace.getAllBlocks(false);
          if (Array.isArray(blocks)) {
            let updated = false;

            blocks.forEach((block: any) => {
              if (!block) return;

              if (typeof block.getField === 'function') {
                // 1. Symbol Field Mutation & Menu Check Fix
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

                // 2. Duration Enforcement
                const durationField = block.getField('DURATION') || block.getField('DURATION_LIST') || block.getField('DURATION_VAL');
                if (durationField && durationField.getValue() !== '5') {
                  durationField.setValue('5');
                  updated = true;
                }

                const unitField = block.getField('DURATION_UNIT') || block.getField('DURATION_UNIT_LIST');
                if (unitField && unitField.getValue() !== 't') {
                  unitField.setValue('t');
                  updated = true;
                }
              }

              // 3. Purchase Block Conditions
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
                    if (field && field.getValue() !== desiredVal) {
                      field.setValue(desiredVal);
                      updated = true;
                    }
                  }
                });
              }
            });

            if (updated && typeof workspace.render === 'function') {
              workspace.render();
            }
          }
        }
      } catch (e) {
        console.error("[AI Scanner Bridge]: Error mutating blocks", e);
      }
    };

    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', 5);
          quickStrategy.setValue('duration_type', 't'); 
          quickStrategy.setValue('amount', payload.stake);
          quickStrategy.setValue('contract_type', storeContractType);
          quickStrategy.setValue('type', storeType);
          quickStrategy.setValue('size', martingaleMultiplier);
          
          if (payload.stopLoss !== undefined) {
            quickStrategy.setValue('loss', payload.stopLoss);
            quickStrategy.setValue('stop_loss', payload.stopLoss);
          }
          if (payload.takeProfit !== undefined) {
            quickStrategy.setValue('profit', payload.takeProfit);
            quickStrategy.setValue('take_profit', payload.takeProfit);
          }
          
          setTimeout(() => {
            applyBlockMutations();
          }, 50);
        }
      } catch (err) {
        console.error("[AI Scanner Bridge Error]: Store injection failed, running fallback block updates:", err);
        applyBlockMutations();
      }
    } else {
      applyBlockMutations();
    }
  }
}
