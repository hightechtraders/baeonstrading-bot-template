import { Strategy } from './strategies';

class ScannerBridgeClass {
  private isListening = false;

  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    console.log(`[AI Scanner] Tick received -> ${assetName}: ${price}`);
  }

  public initLiveTickStream(onTickCallback?: (symbol: string, price: number) => void) {
    if (this.isListening) return;

    const globalWin = window as any;
    const api = globalWin.LiveApi || globalWin.BinarySocket || globalWin.api;
    const rawWs = api?.ws || globalWin.ws || globalWin.appCtx?.websocketInstance;

    if (api && typeof api.send === 'function' && (!rawWs || rawWs.readyState === 1)) {
      const symbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ50', '1HZ100'];

      symbols.forEach((symbol) => {
        try {
          api.send({ ticks: symbol, subscribe: 1 }).then((response: any) => {
            if (response && response.tick) {
              this.pushTick(response.tick.symbol, response.tick.quote, []);
              if (onTickCallback) {
                onTickCallback(response.tick.symbol, response.tick.quote);
              }
            }
          }).catch((err: any) => {
            console.warn('[AI Scanner] Subscribing deferred for symbol:', symbol, err);
          });
        } catch (e) {
          console.error('[AI Scanner] Error calling api.send:', e);
        }
      });

      this.isListening = true;
      console.log('[AI Scanner] Successfully subscribed via official Deriv API client.');
    } else {
      setTimeout(() => this.initLiveTickStream(onTickCallback), 3000);
    }
  }

  private normalizeSymbol(marketOrVol: string): string {
    if (!marketOrVol) return '1HZ50';
    const text = marketOrVol.toLowerCase();
    
    if (text.includes('10s') || text.includes('1hz10')) return '1HZ10';
    if (text.includes('25s') || text.includes('1hz25')) return '1HZ25';
    if (text.includes('50s') || text.includes('1hz50')) return '1HZ50';
    if (text.includes('75s') || text.includes('1hz75')) return '1HZ75';
    if (text.includes('100s') || text.includes('1hz100')) return '1HZ100';

    if (text.includes('10')) return 'R_10';
    if (text.includes('25')) return 'R_25';
    if (text.includes('50')) return 'R_50';
    if (text.includes('75')) return 'R_75';
    if (text.includes('100')) return 'R_100';

    return '1HZ50';
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; takeProfit?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    console.log(`[AI Scanner] Injecting parameters into workspace:`, strategy, options);

    const globalWin = window as any;
    const targetSymbol = options.symbol || this.normalizeSymbol(strategy.market || strategy.volatility);
    
    const direction = strategy.direction || 'UP';
    const targetContract = options.contractType || (direction === 'UP' ? 'CALL' : 'PUT');

    globalWin.tredapendingParams = { ...options, symbol: targetSymbol, contractType: targetContract, strategy };

    let workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();

    setTimeout(() => {
      workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
      if (!workspace) return;

      try {
        const allBlocks = workspace.getAllBlocks(false);
        let blockInjectionCounter = 0;

        allBlocks.forEach((block: any) => {
          // 1. Configure Trade Definition (Market, Submarket, Symbol, and Trade Type)
          if (block.type === 'trade_definition') {
            const marketField = block.getField('MARKET_LIST');
            if (marketField) {
              marketField.setValue('synthetic_index');
              blockInjectionCounter++;
            }

            const submarketField = block.getField('SUBMARKET_LIST');
            if (submarketField) {
              submarketField.setValue('continuous_indices');
              blockInjectionCounter++;
            }

            const symbolField = block.getField('SYMBOL_LIST');
            if (symbolField) {
              // Ensure dropdown options are initialized or forced to accept the value
              if (typeof symbolField.setValue === 'function') {
                symbolField.setValue(targetSymbol);
              }
              // Trigger visual re-render/dropdown refresh if method exists
              if (typeof symbolField.forceRerender === 'function') {
                symbolField.forceRerender();
              } else if (typeof symbolField.beginEdit === 'function' && typeof symbolField.endEdit === 'function') {
                symbolField.beginEdit();
                symbolField.endEdit();
              }
              blockInjectionCounter++;
            }
            
            const tradeTypeField = block.getField('TRADE_TYPE_LIST');
            if (tradeTypeField) {
              tradeTypeField.setValue('callput'); 
              blockInjectionCounter++;
            }
          }

          // 2. Configure Purchase / Contract Type block (CALL / PUT)
          if (block.type === 'purchase' || block.type.includes('purchase') || block.type === 'trade_definition_purchase') {
            const purchaseField = block.getField('PURCHASE_LIST') || block.getField('CONTRACT_TYPE') || block.getField('CB_List');
            if (purchaseField) {
              purchaseField.setValue(targetContract);
              blockInjectionCounter++;
            }
          }

          // 3. Configure Stake, Amount, and Duration options
          if (block.type === 'trade_definition_tradeoptions' || block.type.includes('trade') || block.type.includes('amount')) {
            ['AMOUNT', 'VALUE', 'NUM', 'STAKE', 'DURATION'].forEach(fieldName => {
              const field = block.getField(fieldName);
              if (field) {
                if (fieldName === 'DURATION') {
                  const safeDuration = options.duration !== undefined ? Math.min(Math.max(options.duration, 1), 10) : 5;
                  field.setValue(String(safeDuration));
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
