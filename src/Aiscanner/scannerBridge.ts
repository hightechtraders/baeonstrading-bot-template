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
    console.log(`[AI Scanner] Preparing parameters:`, strategy, options);

    const globalWin = window as any;
    const targetSymbol = options.symbol || this.normalizeSymbol(strategy.market || strategy.volatility);
    const direction = strategy.direction || 'UP';
    const targetContract = options.contractType || (direction === 'UP' ? 'CALL' : 'PUT');

    // Store parameters globally so your UI components can access them cleanly
    globalWin.tredapendingParams = { 
      ...options, 
      symbol: targetSymbol, 
      contractType: targetContract, 
      strategy 
    };

    // Clean Workspace Stake & Contract Type application only (avoids broken symbol dropdown fights)
    let workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();

    setTimeout(() => {
      workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
      if (!workspace) return;

      try {
        const allBlocks = workspace.getAllBlocks(false);
        allBlocks.forEach((block: any) => {
          // Update Purchase contract type cleanly
          if (block.type === 'purchase' || block.type.includes('purchase')) {
            const field = block.getField('PURCHASE_LIST') || block.getField('CONTRACT_TYPE');
            if (field) field.setValue(targetContract);
          }

          // Update Stake cleanly
          if (block.type === 'trade_definition_tradeoptions' || block.type.includes('trade')) {
            const stakeField = block.getField('AMOUNT') || block.getField('STAKE');
            if (stakeField && options.stake !== undefined) {
              stakeField.setValue(String(options.stake));
            }
          }
        });

        workspace.fireChangeListener(new globalWin.Blockly.Events.BlockChange(null, 'edit', '', {}, {}));
        console.log(`[AI Scanner] Workspace updated successfully for symbol target: ${targetSymbol}`);
      } catch (err) {
        console.error('[AI Scanner] Error updating workspace options:', err);
      }
    }, 300);
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
