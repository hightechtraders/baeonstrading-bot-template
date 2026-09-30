import { Strategy } from './strategies';

export interface AIScannerPayload {
  market?: string;
  submarket?: string;
  symbol: string;          // e.g., '1HZ100' or 'R_100'
  tradeType?: string;      // e.g., 'rise_fall'
  stake: number;           // e.g., 10.00
  duration: number;        // e.g., 5
  durationUnit?: 't' | 'm' | 'h' | 'd';
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
    return (
      globalWin.Blockly?.derivWorkspace || 
      globalWin.Blockly?.mainWorkspace || 
      globalWin.Blockly?.getMainWorkspace?.() ||
      globalWin.DBot?.workspace
    );
  }

  /**
   * Main entry point called from floatingai.tsx or strategies.ts
   */
  public injectData(payload: AIScannerPayload): boolean {
    const workspace = this.getWorkspace();
    const globalWin = window as any;
    
    if (!workspace) {
      console.error('[ScannerBridge] Workspace context missing. Ensure Blockly is mounted.');
      return false;
    }

    try {
      // 1. Generate clean configuration XML targeting official Blockly schema nodes
      const strategicXml = this.generateStrategyXml(payload);
      
      // 2. Clear existing blocks safely without wiping memory[cite: 3]
      workspace.clear();

      // 3. Force Blockly to convert the XML string back into active blocks[cite: 3]
      const dom = globalWin.Blockly.Xml.textToDom(strategicXml);
      globalWin.Blockly.Xml.domToWorkspace(dom, workspace);

      // 4. Force update visual layouts and render[cite: 3]
      if (typeof workspace.render === 'function') {
        workspace.render();
      }
      
      console.log(`[ScannerBridge] Successfully forced state payload injection for ${payload.symbol}`);
      return true;
    } catch (e) {
      console.error('[ScannerBridge] XML DOM parsing state error:', e);
      return false;
    }
  }

  /**
   * Recreates the layout structure dynamically with AI variables injected[cite: 3].
   */
  private generateStrategyXml(payload: AIScannerPayload): string {
    const market = payload.market || 'synthetic_index';
    const submarket = payload.submarket || 'random_index';
    const tradeType = payload.tradeType || 'rise_fall';
    const durationUnit = payload.durationUnit || 't';

    return `
    <xml xmlns="http://w3.org" collection="false">
      <block type="trade_definition" id="root_trade_parameters" x="0" y="0">
        <statement name="TRADE_OPTIONS">
          <block type="trade_definition_market">
            <field name="MARKET_LIST">${market}</field>
            <field name="SUBMARKET_LIST">${submarket}</field>
            <field name="SYMBOL_LIST">${payload.symbol}</field>
            <field name="TRADETYPE_LIST">${tradeType}</field>
            <field name="CONTRACT_TYPE_LIST">both</field>
            <field name="CANDLEINTERVAL_LIST">60</field>
            <next>
              <block type="trade_definition_options">
                <field name="DURATIONUNIT_LIST">${durationUnit}</field>
                <value name="DURATION">
                  <shadow type="math_number">
                    <field name="NUM">${payload.duration}</field>
                  </shadow>
                </value>
                <value name="AMOUNT">
                  <shadow type="math_number">
                    <field name="NUM">${payload.stake}</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </statement>
        <statement name="SUBMARKET">
          <block type="trade_definition_purchase">
            <field name="PURCHASE_LIST">rise</field>
          </block>
        </statement>
      </block>
    </xml>
    `.trim();
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
    return this.injectData(payload);
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
