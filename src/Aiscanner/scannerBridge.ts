// ==========================================
// FILE: src/Aiscanner/scannerBridge.ts
// ==========================================
import { RiskManager } from './riskManager';
import { ScannerLogic, DerivTickResponse } from './scannerLogic';
import { api_base } from '@/external/bot-skeleton';

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      
  durationUnit?: string;   
  stopLoss?: number;
  takeProfit?: number;
  multiplier?: number;
  barrier?: string;
}

export class ScannerBridge {
  private static isScannerActive: boolean = false; 
  private static scannerLogicInstance = new ScannerLogic();
  private static activePrediction: string = '2';

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

      // Intercept global API socket requests to automatically inject digit barriers if missing
      ScannerBridge.interceptApiSocket();
    }
  }

  private static interceptApiSocket() {
    try {
      const globalAny = window as any;
      const checkAndHookApi = () => {
        const targetApi = globalAny.BinaryAPI || globalAny.DerivAPI || api_base?.api;
        if (targetApi && typeof targetApi.send === 'function' && !targetApi.__scannerHooked) {
          const originalSend = targetApi.send.bind(targetApi);
          targetApi.send = function (data: any, cb?: any) {
            if (data && data.proposal === 1 && ScannerBridge.isScannerActive) {
              const contractType = String(data.contract_type || '').toUpperCase();
              if ((contractType.includes('DIGIT') || contractType.includes('MATCH') || contractType.includes('DIFF') || contractType.includes('EVEN') || contractType.includes('ODD')) && !data.barrier) {
                data.barrier = ScannerBridge.activePrediction || '2';
              }
            }
            return originalSend(data, cb);
          };
          targetApi.__scannerHooked = true;
        }
      };
      setInterval(checkAndHookApi, 1000);
    } catch (e) {}
  }

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

  public static async executeDirectTrade(strategy: any, options: any) {
    const rootStore = (window as any).derivBotAppStore || (window as any).Bot?.stores;

    if (!rootStore) {
      console.error('Deriv bot app store not available.');
      alert('Trading client not ready. Please make sure you are logged into your Deriv account.');
      return;
    }

    try {
      this.loadStrategyToWorkspace(strategy, options);

      const runPanelStore = rootStore.run_panel || rootStore.quick_strategy;
      if (runPanelStore && typeof runPanelStore.onRunButtonClick === 'function') {
        runPanelStore.onRunButtonClick();
      } else {
        const runButton = document.querySelector('#runButton') || document.querySelector('.run-button') || document.querySelector('[data-testid="run_button"]');
        if (runButton && (runButton as HTMLElement).click) {
          (runButton as HTMLElement).click();
        } else {
          window.dispatchEvent(new CustomEvent('bot_run_start'));
        }
      }

      if (rootStore.ui && typeof rootStore.ui.setActiveTab === 'function') {
        rootStore.ui.setActiveTab('summary');
      }

      console.log('Successfully triggered native live run cycle with dynamic parameters.');
    } catch (error: any) {
      console.error('Trade execution routing failed:', error);
      alert(`Execution Failed: ${error?.message || 'Unknown error occurred'}`);
    }
  }

  public static loadStrategyToWorkspace(strategy: any, options: any) {
    ScannerBridge.isScannerActive = true;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('AI_SCANNER_SESSION_ACTIVE', 'true');
    }

    const rawSymbol = options?.symbol || strategy?.market || strategy?.symbol || '1HZ100V'; 
    const strategyDirection = (options?.contractType || strategy?.direction || strategy?.tradeType || 'rise').toUpperCase();

    let resolvedTradeType = 'rise_fall';
    let storeContractType = 'CALL';
    let storeType = 'rise';
    
    let barrierValue = String(options?.barrier ?? strategy?.barrier ?? strategy?.prediction ?? '2');
    ScannerBridge.activePrediction = barrierValue;

    if (strategyDirection.includes('DIGIT') || strategyDirection.includes('OVER') || strategyDirection.includes('UNDER')) {
      resolvedTradeType = 'matches_differs';
      storeContractType = strategyDirection.includes('UNDER') ? 'DIGITUNDER' : 'DIGITOVER';
      storeType = storeContractType;
    } else if (strategyDirection.includes('EVEN') || strategyDirection.includes('ODD')) {
      resolvedTradeType = 'even_odd';
      storeContractType = strategyDirection;
      storeType = strategyDirection;
    } else if (strategyDirection.includes('MATCH') || strategyDirection.includes('DIFF')) {
      resolvedTradeType = 'matches_differs';
      storeContractType = strategyDirection.includes('MATCH') ? 'DIGITMATCH' : 'DIGITDIFF';
      storeType = storeContractType;
    } else {
      const isFall = strategyDirection.includes('DOWN') || strategyDirection.includes('PUT') || strategyDirection.includes('FALL');
      resolvedTradeType = 'rise_fall';
      storeContractType = isFall ? 'PUT' : 'CALL';
      storeType = isFall ? 'fall' : 'rise';
    }

    const payload: AIScannerPayload = {
      symbol: rawSymbol,
      stake: Number(options?.stake || strategy?.stake || 0.35), 
      duration: Number(options?.duration || strategy?.duration || 5),
      tradeType: strategyDirection,
      durationUnit: options?.durationUnit || 't',
      stopLoss: Number(options?.stopLoss || strategy?.stopLoss || 4.50),     
      takeProfit: Number(options?.takeProfit || strategy?.takeProfit || 3.00),   
      multiplier: Number(options?.multiplier || strategy?.multiplier || 1.5),
      barrier: barrierValue
    };

    RiskManager.configure(payload.stopLoss!, payload.takeProfit!);

    const rootStore = (window as any).derivBotAppStore || (window as any).Bot?.stores;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
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

              if (block.type === 'trade_definition') {
                if (typeof block.setFieldValue === 'function') {
                  try {
                    block.setFieldValue(resolvedTradeType, 'TRADETYPE_LIST');
                  } catch (e) {}
                }
              }

              if (block.type === 'purchase' || block.type?.includes('purchase') || block.type === 'trade_definition_purchase') {
                const fieldNames = ['PURCHASE_LIST', 'PURCHASE_TYPE', 'PURCHASE_CONDITIONS_LIST', 'CONTRACT_TYPE'];
                fieldNames.forEach(name => {
                  const field = block.getField(name);
                  if (field && typeof field.setValue === 'function') {
                    const options = typeof field.getOptions === 'function' ? field.getOptions() : [];
                    let targetMatch = options.find((opt: any) => {
                      const label = String(opt[0] || '').toLowerCase();
                      const val = String(opt[1] || '').toLowerCase();
                      return label.includes(storeContractType.toLowerCase()) || val.includes(storeContractType.toLowerCase());
                    });

                    if (!targetMatch && field.menuGenerator_ && Array.isArray(field.menuGenerator_)) {
                      field.menuGenerator_.push([storeContractType, storeContractType]);
                    }

                    const desiredVal = targetMatch ? targetMatch[1] : storeContractType;
                    if (field && field.getValue() !== desiredVal) {
                      field.setValue(desiredVal);
                      updated = true;
                    }
                  }
                });
              }

              // Update barrier/prediction fields on blocks if present
              const barrierFields = ['BARRIER', 'PREDICTION', 'DIGIT_PREDICTION'];
              barrierFields.forEach(fieldName => {
                const field = block.getField(fieldName);
                if (field && typeof field.setValue === 'function') {
                  field.setValue(barrierValue);
                  updated = true;
                }
              });
            });

            if (updated && typeof workspace.render === 'function') {
              workspace.render();
            }
          }
        }
      } catch (e) {}
    };

    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('duration_type', payload.durationUnit || 't'); 
          quickStrategy.setValue('amount', payload.stake);
          quickStrategy.setValue('tradetype', resolvedTradeType);
          quickStrategy.setValue('contract_type', storeContractType);
          quickStrategy.setValue('type', storeType);
          quickStrategy.setValue('size', martingaleMultiplier);
          
          if (storeContractType.includes('DIGIT') || storeContractType.includes('MATCH') || storeContractType.includes('DIFF') || storeContractType.includes('EVEN') || storeContractType.includes('ODD')) {
            quickStrategy.setValue('prediction', payload.barrier);
            quickStrategy.setValue('barrier', payload.barrier);
          }

          if (payload.stopLoss !== undefined) {
            quickStrategy.setValue('loss', payload.stopLoss);
            quickStrategy.setValue('stop_loss', payload.stopLoss);
          }
          if (payload.takeProfit !== undefined) {
            quickStrategy.setValue('profit', payload.takeProfit);
            quickStrategy.setValue('take_profit', payload.takeProfit);
          }
        }
        
        const mockFormData: any = {
          symbol: strictDerivSymbol, 
          durationtype: payload.durationUnit || 't', 
          duration: payload.duration,
          stake: payload.stake,
          amount: payload.stake,
          tradetype: resolvedTradeType,
          contract_type: storeContractType,
          type: storeType,
          subtype: storeType,
          size: martingaleMultiplier,
          loss: payload.stopLoss,
          stop_loss: payload.stopLoss,
          profit: payload.takeProfit,
          take_profit: payload.takeProfit
        };

        if (storeContractType.includes('DIGIT') || storeContractType.includes('MATCH') || storeContractType.includes('DIFF') || storeContractType.includes('EVEN') || storeContractType.includes('ODD')) {
          mockFormData.prediction = payload.barrier;
          mockFormData.barrier = payload.barrier;
        }

        const submitAction = quickStrategy.onSubmit || quickStrategy.createStrategy;
        if (typeof submitAction === 'function') {
          Promise.resolve(submitAction.call(quickStrategy, mockFormData)).then(() => {
            setTimeout(() => {
              applyBlockMutations();
              if (rootStore?.client?.send) {
                rootStore.client.send({ balance: 1, subscribe: 1 }).catch(() => {});
              }
            }, 150);
          }).catch(() => {});
        }
      } catch (error) {}
    }

    applyBlockMutations();
    return true;
  }
}

export const scannerBridge = ScannerBridge;
