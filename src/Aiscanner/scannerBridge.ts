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

  private resolveMarketConfig(marketOrVol: string): { market: string; submarket: string; symbol: string } {
    const text = (marketOrVol || '').toLowerCase();

    // Distinguish between 1-second indices (Continuous Indices) vs regular volatility indices
    if (text.includes('10s') || text.includes('1hz10')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ10' };
    if (text.includes('25s') || text.includes('1hz25')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ25' };
    if (text.includes('50s') || text.includes('1hz50')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ50' };
    if (text.includes('75s') || text.includes('1hz75')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ75' };
    if (text.includes('100s') || text.includes('1hz100')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ100' };

    if (text.includes('10')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_10' };
    if (text.includes('25')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_25' };
    if (text.includes('50')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_50' };
    if (text.includes('75')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_75' };
    if (text.includes('100')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_100' };

    return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ50' };
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; takeProfit?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    console.log(`[AI Scanner] Loading strategy:`, strategy, options);

    const globalWin = window as any;
    const config = this.resolveMarketConfig(options.symbol || strategy.market || strategy.volatility);
    const direction = strategy.direction || 'UP';
    const targetContract = options.contractType || (direction === 'UP' ? 'CALL' : 'PUT');
    const safeDuration = options.duration !== undefined ? Math.min(Math.max(options.duration, 1), 10) : 5;
    const safeStake = options.stake !== undefined ? options.stake : 10;

    globalWin.tredapendingParams = { ...options, duration: safeDuration, stake: safeStake, ...config, contractType: targetContract, strategy };

    let workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();

    setTimeout(() => {
      workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
      if (!workspace) return;

      try {
        const allBlocks = workspace.getAllBlocks(false);
        let updateCount = 0;

        allBlocks.forEach((block: any) => {
          // 1. Update Trade Parameters Block (Market, Submarket, Symbol, Contract Type)
          if (block.type === 'trade_definition') {
            try {
              block.setFieldValue(config.market, 'MARKET_LIST');
              block.setFieldValue(config.submarket, 'SUBMARKET_LIST');
              
              const symbolField = block.getField('SYMBOL_LIST');
              if (symbolField) {
                if (typeof symbolField.setValue === 'function') {
                  symbolField.setValue(config.symbol);
                }
              }
              block.setFieldValue(targetContract, 'TRADE_TYPE_LIST');
              updateCount++;
            } catch (e) {
              console.warn('[AI Scanner] Trade definition field update warning:', e);
            }
          }

          // 2. Update Purchase Contract Type Block (CALL/PUT)
          if (block.type === 'purchase' || block.type.includes('purchase')) {
            const purchaseField = block.getField('PURCHASE_LIST') || block.getField('CONTRACT_TYPE');
            if (purchaseField) {
              purchaseField.setValue(targetContract);
              updateCount++;
            }
          }

          // 3. Update Stake and Duration Options
          if (block.type.includes('trade') || block.type.includes('amount') || block.type.includes('option')) {
            ['AMOUNT', 'VALUE', 'NUM', 'STAKE', 'DURATION'].forEach(fieldName => {
              const field = block.getField(fieldName);
              if (field) {
                if (fieldName === 'DURATION') {
                  field.setValue(String(safeDuration));
                  updateCount++;
                } else {
                  field.setValue(String(safeStake));
                  updateCount++;
                }
              }
            });

            block.inputList?.forEach((input: any) => {
              const targetBlock = input.connection?.targetBlock();
              if (targetBlock) {
                ['NUM', 'AMOUNT', 'VALUE'].forEach(numFieldName => {
                  const numField = targetBlock.getField(numFieldName);
                  if (numField) {
                    if (input.name === 'DURATION') {
                      numField.setValue(String(safeDuration));
                    } else {
                      numField.setValue(String(safeStake));
                    }
                    updateCount++;
                  }
                });
              }
            });
          }
        });

        if (updateCount > 0) {
          workspace.fireChangeListener(new globalWin.Blockly.Events.BlockChange(null, 'edit', '', {}, {}));
          console.log(`[AI Scanner] Successfully aligned market (${config.symbol}) and parameters.`);
        }
      } catch (err) {
        console.error('[AI Scanner] Error aligning workspace blocks:', err);
      }
    }, 300);
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
