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

  /**
   * Pure canvas field updater that changes parameters in-place,
   * leaving attached child blocks (like Martingale multipliers) completely untouched.
   */
  public static injectViaStore(payload: AIScannerPayload): boolean {
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    const rawTradeType = (payload.tradeType || 'rise').toLowerCase();
    const isFall = rawTradeType.includes('down') || rawTradeType.includes('put') || rawTradeType.includes('fall');
    const targetType = isFall ? 'fall' : 'rise';
    const blocklyTradeType = isFall ? 'Fall' : 'Rise';

    console.log(`[ScannerBridge] Volatility: ${strictDerivSymbol} | Purchase Type: ${blocklyTradeType}`);

    // EXPLICITLY SKIPPED: quick_strategy store mutations and form submissions 
    // because they clear out custom workspace child blocks like Martingale.

    // Safely update existing canvas blocks in-place
    setTimeout(() => {
      try {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.mainWorkspace || Blockly?.derivWorkspace || Blockly?.getMainWorkspace?.();

        if (workspace && typeof workspace.getAllBlocks === 'function') {
          const blocks = workspace.getAllBlocks(false);
          if (Array.isArray(blocks)) {
            blocks.forEach((block: any) => {
              if (!block || typeof block.getField !== 'function') return;

              // 1. Update Symbol
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

              // 2. Update Stake and Duration fields
              ['AMOUNT', 'VALUE', 'NUM', 'STAKE', 'DURATION'].forEach(fieldName => {
                const field = block.getField(fieldName);
                if (field && typeof field.setValue === 'function') {
                  if (fieldName === 'DURATION') {
                    field.setValue(String(payload.duration || 5));
                  } else if (fieldName !== 'DURATION' && payload.stake !== undefined) {
                    field.setValue(String(payload.stake));
                  }
                }
              });

              // 3. Update Purchase Conditions (Rise/Fall)
              if (block.type === 'purchase' || block.type?.includes('purchase') || block.type === 'trade_definition_purchase') {
                const typeField = block.getField('PURCHASE_LIST') || 
                                  block.getField('PURCHASE_TYPE') || 
                                  block.getField('PURCHASE_CONDITIONS_LIST') ||
                                  block.getField('CONTRACT_TYPE');

                if (typeField && typeof typeField.setValue === 'function') {
                  const options = typeof typeField.getOptions === 'function' ? typeField.getOptions() : [];
                  const matchedOption = options.find((opt: any) => 
                    opt[0].toLowerCase().includes(targetType) || 
                    opt[1].toLowerCase().includes(targetType)
                  );
                  const valueToSet = matchedOption ? matchedOption[1] : blocklyTradeType;
                  typeField.setValue(valueToSet);
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
    }, 250);

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
