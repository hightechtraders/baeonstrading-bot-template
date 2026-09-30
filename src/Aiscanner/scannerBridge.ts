// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          // e.g., '1HZ100V' for Volatility 100 (1s) Index
  tradeType?: string;      // e.g., 'rise_fall'
  durationUnit?: string;   // e.g., 't'
}

export class ScannerBridge {
  /**
   * Directly interacts with RootStore's quick_strategy and workspace 
   * to inject parameters safely.
   */
  public static injectViaStore(payload: AIScannerPayload): boolean {
    const rootStore = (window as any).derivBotAppStore;
    
    if (!rootStore) {
      console.warn("[ScannerBridge] derivBotAppStore not found on window. Trying direct workspace injection...");
      return this.injectDataLegacy(payload);
    }

    try {
      const quickStrategy = rootStore.quick_strategy;
      
      if (quickStrategy) {
        // Update known properties on QuickStrategyStore directly
        if ('selected_symbol' in quickStrategy) quickStrategy.selected_symbol = payload.symbol;
        if ('symbol' in quickStrategy) quickStrategy.symbol = payload.symbol;
        if ('stake' in quickStrategy) quickStrategy.stake = payload.stake;
        if ('amount' in quickStrategy) quickStrategy.amount = payload.stake;
        if ('duration' in quickStrategy) quickStrategy.duration = payload.duration;
        
        // If there is a form state or options object inside quick_strategy
        if (quickStrategy.form_values) {
          quickStrategy.form_values.symbol = payload.symbol;
          quickStrategy.form_values.amount = payload.stake;
          quickStrategy.form_values.duration = payload.duration;
        }

        // Trigger any available change handler or re-render method
        if (typeof quickStrategy.onParametersChange === 'function') {
          quickStrategy.onParametersChange();
        }
      }

      // Ensure Blockly workspace blocks are also synchronized with these values
      return this.injectDataLegacy(payload);
    } catch (error) {
      console.error("[ScannerBridge] Error during store parameter injection:", error);
      return this.injectDataLegacy(payload);
    }
  }

  /**
   * Direct Blockly workspace XML mutation fallback to guarantee values apply
   */
  private static injectDataLegacy(payload: AIScannerPayload): boolean {
    const workspace = (window as any).Blockly?.mainWorkspace;
    if (!workspace) {
      console.error("[ScannerBridge] No active Blockly workspace context found.");
      return false;
    }

    try {
      const xmlString = `
        <xml xmlns="http://w3.org" collection="false">
          <block type="trade_definition" id="root_trade_parameters" x="0" y="0">
            <statement name="TRADE_OPTIONS">
              <block type="trade_definition_market">
                <field name="MARKET_LIST">synthetic_index</field>
                <field name="SUBMARKET_LIST">random_index</field>
                <field name="SYMBOL_LIST">${payload.symbol}</field>
                <field name="TRADETYPE_LIST">${payload.tradeType || 'rise_fall'}</field>
                <next>
                  <block type="trade_definition_options">
                    <field name="DURATIONUNIT_LIST">${payload.durationUnit || 't'}</field>
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
          </block>
        </xml>
      `.trim();

      workspace.clear();
      const dom = (window as any).Blockly.Xml.textToDom(xmlString);
      (window as any).Blockly.Xml.domToWorkspace(dom, workspace);
      workspace.render();
      console.log(`[ScannerBridge] Successfully injected payload for symbol: ${payload.symbol}`);
      return true;
    } catch (e) {
      console.error("[ScannerBridge] Workspace XML injection failed:", e);
      return false;
    }
  }

  // Wrapper for strategies compatibility
  public static loadStrategyToWorkspace(strategy: any, options: { stake?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    const payload: AIScannerPayload = {
      symbol: options.symbol || strategy.symbol || '1HZ75',
      stake: options.stake || strategy.recommendedStake || 10,
      duration: options.duration || 5,
      tradeType: options.contractType || 'rise_fall'
    };
    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
