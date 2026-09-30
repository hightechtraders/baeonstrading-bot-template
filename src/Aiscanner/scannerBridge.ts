import { Strategy } from './strategies';

export interface AIScannerPayload {
  market: string;          // e.g., 'synthetic_index'
  submarket: string;       // e.g., 'random_index'
  symbol: string;          // e.g., 'R_100' or '1HZ75'
  tradeType: string;       // e.g., 'callput' or 'rise_fall'
  stake: number;           // e.g., 10
  duration: number;        // e.g., 5
  durationUnit: 't' | 'm' | 'h' | 'd'; // Ticks, Minutes, Hours, Days
}

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

  private getWorkspace(): any {
    const globalWin = window as any;
    const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.mainWorkspace || globalWin.Blockly?.getMainWorkspace?.();
    if (!workspace) {
      console.warn('[ScannerBridge] Active Blockly workspace context not found.');
      return null;
    }
    return workspace;
  }

  public injectData(payload: AIScannerPayload): boolean {
    const workspace = this.getWorkspace();
    const globalWin = window as any;
    if (!workspace) return false;

    try {
      if (typeof workspace.setResamplable === 'function') workspace.setResamplable(false);
      if (globalWin.Blockly?.Events) globalWin.Blockly.Events.disable();

      const allBlocks = workspace.getAllBlocks(false);

      this.updateMarketSettings(allBlocks, payload);
      this.updateTradeTypeSettings(allBlocks, payload);
      this.updateTradeNumericalOptions(allBlocks, payload);

      if (globalWin.Blockly?.Events) globalWin.Blockly.Events.enable();
      if (typeof workspace.setResamplable === 'function') workspace.setResamplable(true);

      if (typeof workspace.render === 'function') {
        workspace.render();
      }
      
      console.log('[ScannerBridge] Successfully synchronized parameters to workspace layout.');
      return true;
    } catch (error) {
      const win = window as any;
      if (win.Blockly?.Events) win.Blockly.Events.enable();
      const ws = this.getWorkspace();
      if (ws && typeof ws.setResamplable === 'function') ws.setResamplable(true);
      console.error('[ScannerBridge] Critical failure during structural data injection:', error);
      return false;
    }
  }

  private updateMarketSettings(blocks: any[], payload: AIScannerPayload): void {
    const marketBlock = blocks.find((b) => b.type === 'trade_definition_market' || b.type === 'trade_definition');
    if (!marketBlock) return;
    const marketField = marketBlock.getField('MARKET_LIST');
    const submarketField = marketBlock.getField('SUBMARKET_LIST');
    const symbolField = marketBlock.getField('SYMBOL_LIST');
    if (marketField) marketField.setValue(payload.market);
    if (submarketField) submarketField.setValue(payload.submarket);
    if (symbolField) symbolField.setValue(payload.symbol);
  }

  private updateTradeTypeSettings(blocks: any[], payload: AIScannerPayload): void {
    const tradeTypeBlock = blocks.find((b) => b.type === 'trade_definition_tradetype' || b.type === 'trade_definition');
    if (!tradeTypeBlock) return;
    const typeField = tradeTypeBlock.getField('TRADETYPE_LIST') || tradeTypeBlock.getField('TRADE_TYPE_LIST');
    if (typeField) typeField.setValue(payload.tradeType);
  }

  private updateTradeNumericalOptions(blocks: any[], payload: AIScannerPayload): void {
    const optionsBlock = blocks.find((b) => b.type === 'trade_definition_options' || b.type === 'trade_definition');
    if (!optionsBlock) return;

    const stakeInput = optionsBlock.getInput('AMOUNT') || optionsBlock.getInput('STAKE');
    if (stakeInput?.connection) {
      const targetShadow = stakeInput.connection.targetBlock();
      if (targetShadow) {
        targetShadow.setFieldValue(payload.stake.toString(), 'NUM');
      }
    }

    const durationInput = optionsBlock.getInput('DURATION');
    if (durationInput?.connection) {
      const targetShadow = durationInput.connection.targetBlock();
      if (targetShadow) {
        targetShadow.setFieldValue(payload.duration.toString(), 'NUM');
      }
    }

    const unitField = optionsBlock.getField('DURATIONUNIT_LIST');
    if (unitField) {
      unitField.setValue(payload.durationUnit);
    }
  }

  // Backward compatibility wrapper for existing strategy calls
  public loadStrategyToWorkspace(strategy: any, options: { stake?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    const isOneSec = options.symbol?.includes('1HZ') || strategy.market?.includes('1HZ');
    const payload: AIScannerPayload = {
      market: 'synthetic_index',
      submarket: isOneSec ? 'continuous_indices' : 'random_index',
      symbol: options.symbol || strategy.symbol || '1HZ75',
      tradeType: options.contractType || (strategy.direction === 'UP' ? 'CALL' : 'PUT'),
      stake: options.stake || strategy.recommendedStake || 10,
      duration: options.duration || 5,
      durationUnit: 't'
    };
    this.injectData(payload);
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
