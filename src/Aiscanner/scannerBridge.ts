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
      const symbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ10', '1HZ25', '1HZ50', '1HZ75', '1HZ100'];

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

  private resolveMarketConfig(marketOrVol: any): { market: string; submarket: string; symbol: string } {
    const rawInput = typeof marketOrVol === 'object' && marketOrVol !== null 
      ? (marketOrVol.symbol || marketOrVol.volatility || marketOrVol.market || '') 
      : (marketOrVol || '');

    const text = String(rawInput).toUpperCase().trim();

    if (text.includes('1HZ10') || text.includes('10 (1S)') || text.includes('10S')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ10' };
    if (text.includes('1HZ25') || text.includes('25 (1S)') || text.includes('25S')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ25' };
    if (text.includes('1HZ50') || text.includes('50 (1S)') || text.includes('50S')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ50' };
    if (text.includes('1HZ75') || text.includes('75 (1S)') || text.includes('75S')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ75' };
    if (text.includes('1HZ100') || text.includes('100 (1S)') || text.includes('100S')) return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ100' };

    if (text.includes('10')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_10' };
    if (text.includes('25')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_25' };
    if (text.includes('50')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_50' };
    if (text.includes('75')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_75' };
    if (text.includes('100')) return { market: 'synthetic_index', submarket: 'random_index', symbol: 'R_100' };

    return { market: 'synthetic_index', submarket: 'continuous_indices', symbol: '1HZ75' };
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake?: number; stopLoss?: number; takeProfit?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    console.log(`[AI Scanner] Injecting strategy data into workspace:`, strategy, options);

    const globalWin = window as any;
    const config = this.resolveMarketConfig(options.symbol || strategy.market || strategy.volatility);
    const direction = strategy.direction || 'UP';
    const targetContract = options.contractType || (direction === 'UP' ? 'CALL' : 'PUT');
    const safeDuration = options.duration !== undefined ? Math.min(Math.max(options.duration, 1), 10) : 5;
    const safeStake = options.stake !== undefined ? options.stake : (strategy.recommendedStake || 10);
    const safeStopLoss = options.stopLoss !== undefined ? options.stopLoss : (strategy.recommendedStopLoss || 20);
    const safeTakeProfit = options.takeProfit !== undefined ? options.takeProfit : (strategy.recommendedTakeProfit || 50);

    const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
    if (!workspace) {
      console.warn('[AI Scanner] Blockly workspace not found yet.');
      return;
    }

    try {
      const allBlocks = workspace.getAllBlocks(false);

      allBlocks.forEach((block: any) => {
        // 1. Inject Trade Parameters (Market, Submarket, Symbol, Trade Type)
        if (block.type === 'trade_definition' || block.type === 'trade_definition_market' || block.type.includes('market')) {
          try {
            block.setFieldValue(config.market, 'MARKET_LIST');
            block.setFieldValue(config.submarket, 'SUBMARKET_LIST');
            block.setFieldValue(config.symbol, 'SYMBOL_LIST');
            block.setFieldValue('callput', 'TRADE_TYPE_LIST');
          } catch (e) {
            console.warn('[AI Scanner] Field assignment warning:', e);
          }
        }

        // 2. Inject Purchase Contract Type (Call/Put)
        if (block.type === 'purchase' || block.type.includes('purchase')) {
          const purchaseField = block.getField('PURCHASE_LIST') || block.getField('CONTRACT_TYPE');
          if (purchaseField) {
            purchaseField.setValue(targetContract);
          }
        }

        // 3. Inject Stake and Duration values directly into parameter fields
        if (block.type.includes('trade') || block.type.includes('amount') || block.type.includes('option')) {
          ['AMOUNT', 'VALUE', 'NUM', 'STAKE', 'DURATION'].forEach(fieldName => {
            const field = block.getField(fieldName);
            if (field) {
              field.setValue(String(fieldName === 'DURATION' ? safeDuration : safeStake));
            }
          });
        }
      });

      // Fire change event so Deriv's template UI updates instantly
      workspace.fireChangeListener(new globalWin.Blockly.Events.BlockChange(null, 'edit', '', {}, {}));
      console.log(`[AI Scanner] Successfully injected parameters for ${config.symbol} (${targetContract}).`);
    } catch (err) {
      console.error('[AI Scanner] Error injecting data into workspace blocks:', err);
    }
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
