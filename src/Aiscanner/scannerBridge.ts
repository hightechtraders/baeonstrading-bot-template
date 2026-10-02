// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      
  durationUnit?: string;   
  stopLoss?: number;
  takeProfit?: number;
}

export class ScannerBridge {
  private static isScannerActive: boolean = false; 

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
    // Absolute gate: If the user hasn't clicked load from the scanner, do nothing.
    if (!ScannerBridge.isScannerActive) return false;

    const rootStore = (window as any).derivBotAppStore;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    const rawTradeType = (payload.tradeType || 'rise').toLowerCase();
    const isFall = rawTradeType.includes('down') || rawTradeType.includes('put') || rawTradeType.includes('fall');
    
    const storeContractType = isFall ? 'PUT' : 'CALL';
    const storeType = isFall ? 'fall' : 'rise';
    const martingaleMultiplier = 2.4;

    if (rootStore?.quick_strategy) {
      try {
        const quickStrategy = rootStore.quick_strategy;
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('amount', payload.stake);
          quickStrategy.setValue('contract_type', storeContractType);
          quickStrategy.setValue('type', storeType);
          quickStrategy.setValue('size', martingaleMultiplier);
        }
      } catch (error) {}
    }

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
                  symbolField.setValue(strictDerivSymbol);
                  updated = true;
                }
              }
            });

            if (updated && typeof workspace.render === 'function') {
              workspace.render();
            }
          }
        }
      } catch (e) {}
    };

    applyBlockMutations();
    setTimeout(applyBlockMutations, 300);

    return true;
  }

  public static loadStrategyToWorkspace(strategy: any, options: any) {
    // Only set to true right when the user explicitly clicks load from the scanner
    ScannerBridge.isScannerActive = true;

    const rawSymbol = options?.symbol || strategy?.market || strategy?.symbol || '1HZ100V'; 
    const strategyDirection = options?.contractType || strategy?.direction || strategy?.tradeType || 'rise';

    const payload: AIScannerPayload = {
      symbol: rawSymbol,
      stake: options?.stake || strategy?.recommendedStake || strategy?.stake || 10,
      duration: options?.duration || strategy?.duration || 5,
      tradeType: strategyDirection,
      stopLoss: options?.stopLoss || strategy?.stopLoss || 150,
      takeProfit: options?.takeProfit || strategy?.takeProfit || 100
    };

    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
