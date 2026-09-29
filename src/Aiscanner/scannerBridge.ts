import { Strategy } from './strategies';

class ScannerBridgeClass {
  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    console.log(`[AI Scanner] Tick received -> ${assetName}: ${price}`);
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; takeProfit?: number; [key: string]: any }) {
    console.log(`[AI Scanner] Loading strategy into Blockly workspace:`, strategy, options);

    const Blockly = (window as any).Blockly;
    const workspace = Blockly?.getMainWorkspace?.();

    if (!workspace) {
      console.warn('[AI Scanner] Blockly workspace not found on window object.');
      return;
    }

    try {
      // 1. Clear existing workspace blocks if needed, or generate trade XML block template
      workspace.clear();

      // 2. Build or load strategy XML block structure for Deriv Bot
      // If the strategy contains a custom block template or xml string, use it. Otherwise, generate standard trade blocks.
      const strategyXml = strategy.xml || `
        <xml xmlns="http://www.w3.org/1999/xhtml">
          <block type="trade_definition" x="0" y="0">
            <statement name="SUBMARKET">
              <block type="trade_definition_market">
                <field name="MARKET_LIST">synthetic_index</field>
                <field name="SUBMARKET_LIST">random_index</field>
                <field name="SYMBOL_LIST">R_100</field>
                <statement name="STRATEGY_LIST">
                  <block type="trade_definition_tradeoptions">
                    <field name="DURATION_TYPE_LIST">t</field>
                    <value name="DURATION">
                      <shadow type="math_number">
                        <field name="NUM">1</field>
                      </shadow>
                    </value>
                    <value name="AMOUNT">
                      <shadow type="math_number">
                        <field name="NUM">${options.stake || 1}</field>
                      </shadow>
                    </value>
                  </block>
                </statement>
              </block>
            </statement>
          </block>
        </xml>
      `;

      // 3. Parse and load the XML into the active Blockly workspace
      const dom = Blockly.Xml.textToDom(strategyXml);
      Blockly.Xml.domToWorkspace(dom, workspace);

      console.log('[AI Scanner] Successfully loaded strategy XML into workspace.');
    } catch (error) {
      console.error('[AI Scanner] Failed to inject strategy into workspace:', error);
    }
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
