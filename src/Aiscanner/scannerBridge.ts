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
    try {
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
    } catch (err) {
      console.error('Error processing live tick feed:', err);
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
      ScannerBridge.isScannerActive = true;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('AI_SCANNER_SESSION_ACTIVE', 'true');
      }

      // Extract properties dynamically from the clicked strategy card or options
      const rawSymbol = options?.symbol || strategy?.market || strategy?.symbol || '1HZ100V';
      const strictSymbol = ScannerBridge.translateSymbol(rawSymbol);
      const contractType = (options?.contractType || strategy?.contractType || strategy?.direction || 'CALL').toUpperCase();
      const stake = Number(options?.stake || strategy?.recommendedStake || strategy?.stake || 0.35);
      const barrierValue = String(options?.barrier || strategy?.barrier || strategy?.prediction || '2');
      
      ScannerBridge.activePrediction = barrierValue;

      // Programmatically update Deriv's Quick Strategy store with the clicked card's parameters
      const quickStrategy = rootStore.quick_strategy;
      if (quickStrategy && typeof quickStrategy.setValue === 'function') {
        quickStrategy.setValue('symbol', strictSymbol);
        quickStrategy.setValue('amount', stake);
        quickStrategy.setValue('contract_type', contractType);
        
        if (contractType.includes('DIGIT') || contractType.includes('MATCH') || contractType.includes('DIFF')) {
          quickStrategy.setValue('prediction', barrierValue);
          quickStrategy.setValue('barrier', barrierValue);
        }
      }

      // Trigger the run cycle
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

      console.log(`Successfully executed strategy: ${strategy?.name || 'Custom'} on symbol ${strictSymbol}`);
    } catch (error: any) {
      console.error('Trade execution routing failed:', error);
    }
  }

  public static loadStrategyToWorkspace(strategy: any, options: any) {
    try {
      ScannerBridge.executeDirectTrade(strategy, options);
    } catch (e) {
      console.warn('Workspace strategy load warning:', e);
    }
    return true;
  }
}

export const scannerBridge = ScannerBridge;
