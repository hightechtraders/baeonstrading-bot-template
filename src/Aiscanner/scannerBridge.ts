import { Strategy } from './strategies';

class ScannerBridgeClass {
  private isListening = false;

  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    console.log(`[AI Scanner] Tick received -> ${assetName}: ${price}`);
  }

  // Initialize live WebSocket tick subscriptions across volatility indices
  public initLiveTickStream(onTickCallback?: (symbol: string, price: number) => void) {
    if (this.isListening) return;

    const globalWin = window as any;
    const ws = globalWin.ws || globalWin.BinarySocket || globalWin.LiveApi?.ws;

    if (ws && typeof ws.send === 'function') {
      const symbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ50', '1HZ100'];
      
      symbols.forEach((symbol) => {
        ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      });

      ws.addEventListener('message', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'tick' && data.tick) {
            const { symbol, quote } = data.tick;
            this.pushTick(symbol, quote, []);
            if (onTickCallback) {
              onTickCallback(symbol, quote);
            }
          }
        } catch (err) {
          console.error('[AI Scanner] Error parsing incoming tick stream:', err);
        }
      });

      this.isListening = true;
      console.log('[AI Scanner] Successfully hooked into live Deriv WebSocket tick stream.');
    } else {
      console.warn('[AI Scanner] Active WebSocket connection not found yet. Retrying...');
      setTimeout(() => this.initLiveTickStream(onTickCallback), 2000);
    }
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; takeProfit?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    console.log(`[AI Scanner] Injecting parameters into workspace:`, strategy, options);

    const globalWin = window as any;
    globalWin.tredapendingParams = { ...options, strategy };

    let workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();

    setTimeout(() => {
      workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
      if (!workspace) return;

      try {
        const allBlocks = workspace.getAllBlocks(false);
        let blockInjectionCounter = 0;

        allBlocks.forEach((block: any) => {
          if (block.type === 'trade_definition') {
            const symbolField = block.getField('SYMBOL_LIST');
            if (symbolField && options.symbol) {
              symbolField.setValue(options.symbol);
              blockInjectionCounter++;
            }
            const tradeTypeField = block.getField('TRADE_TYPE_LIST');
            if (tradeTypeField && options.tradeType) {
              tradeTypeField.setValue(options.tradeType);
              blockInjectionCounter++;
            }
          }

          if (block.type === 'purchase' || block.type.includes('purchase')) {
            const purchaseField = block.getField('PURCHASE_LIST') || block.getField('CONTRACT_TYPE');
            if (purchaseField && (strategy.contractType || options.contractType)) {
              purchaseField.setValue(strategy.contractType || options.contractType);
              blockInjectionCounter++;
            }
          }

          if (block.type === 'trade_definition_tradeoptions' || block.type.includes('trade') || block.type.includes('amount')) {
            ['AMOUNT', 'VALUE', 'NUM', 'STAKE', 'DURATION'].forEach(fieldName => {
              const field = block.getField(fieldName);
              if (field) {
                if (fieldName === 'DURATION' && options.duration !== undefined) {
                  const clampedDuration = Math.min(Math.max(options.duration, 1), 10);
                  field.setValue(String(clampedDuration));
                  blockInjectionCounter++;
                } else if (fieldName !== 'DURATION' && options.stake !== undefined) {
                  field.setValue(String(options.stake));
                  blockInjectionCounter++;
                }
              }
            });

            block.inputList?.forEach((input: any) => {
              const targetBlock = input.connection?.targetBlock();
              if (targetBlock) {
                ['NUM', 'AMOUNT', 'VALUE'].forEach(numFieldName => {
                  const numField = targetBlock.getField(numFieldName);
                  if (numField) {
                    if (input.name === 'AMOUNT' && options.stake !== undefined) {
                      numField.setValue(String(options.stake));
                      blockInjectionCounter++;
                    } else if (input.name === 'DURATION') {
                      const safeDuration = options.duration !== undefined ? Math.min(Math.max(options.duration, 1), 10) : 5;
                      numField.setValue(String(safeDuration));
                      blockInjectionCounter++;
                    }
                  }
                });
              }
            });
          }
        });

        if (blockInjectionCounter > 0) {
          workspace.fireChangeListener(new globalWin.Blockly.Events.BlockChange(
            null, 'edit', '', {}, {}
          ));
          console.log(`[AI Scanner] Successfully updated ${blockInjectionCounter} fields on workspace blocks.`);
        } else {
          console.warn('[AI Scanner] No matching block fields found to update.');
        }
      } catch (err) {
        console.error('[AI Scanner] Error injecting block parameters:', err);
      }
    }, 300);
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
