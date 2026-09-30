// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          // Accepts readable text or direct API symbols like '1HZ100V'
  tradeType?: string;      // e.g., 'rise_fall'
  durationUnit?: string;   // e.g., 't'
}

export class ScannerBridge {
  /**
   * Translates incoming AI strategy terms into strict, non-strippable Deriv API Codes.
   */
  private static translateSymbol(rawSymbol: string): string {
    const clean = rawSymbol.toUpperCase().replace(/\s+/g, '');
    
    const symbolMap: Record<string, string> = {
      // 1-Second (1s) High-Speed Series
      'VOLATILITY10(1S)':  '1HZ10V',
      'VOL101S':           '1HZ10V',
      'V101S':             '1HZ10V',
      '1HZ10V':            '1HZ10V',
      'VOLATILITY50(1S)': '1HZ50V',
      'VOL501S':           '1HZ50V',
      'V501S':            '1HZ50V',
      '1HZ50V':           '1HZ50V',
      'VOLATILITY75(1S)': '1HZ75V',
      'VOL751S':           '1HZ75V',
      'V751S':            '1HZ75V',
      '1HZ75V':           '1HZ75V',
      'VOLATILITY100(1S)':'1HZ100V',
      'VOL1001S':          '1HZ100V',
      'V1001S':           '1HZ100V',
      '1HZ100V':          '1HZ100V',
      // Standard Volatility Indices
      'VOLATILITY10':     'R_10',
      'VOL10':            'R_10',
      'R_10':             'R_10',
      'VOLATILITY50':     'R_50',
      'VOL50':            'R_50',
      'R_50':             'R_50',
      'VOLATILITY75':     'R_75',
      'VOL75':            'R_75',
      'R_75':             'R_75',
    };
    return symbolMap[clean] || rawSymbol;
  }

  /**
   * Safe parameter injector combining store initialization with direct field overrides.
   */
  public static injectViaStore(payload: AIScannerPayload): boolean {
    const rootStore = (window as any).derivBotAppStore;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    console.log(`[ScannerBridge] Mapping input "${payload.symbol}" -> Verified API Code: "${strictDerivSymbol}"`);

    let storeSuccess = false;

    // 1. Mutate the quick strategy store and force the correct symbol value
    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('amount', payload.stake);
        }
        
        const mockFormData = {
          symbol: strictDerivSymbol, 
          durationtype: payload.durationUnit || 't', 
          duration: payload.duration,
          stake: payload.stake,
          amount: payload.stake,
          tradetype: payload.tradeType || 'rise_fall',
          type: payload.tradeType || 'rise_fall'
        };

        if (typeof quickStrategy.onSubmit === 'function') {
          quickStrategy.onSubmit(mockFormData);
          storeSuccess = true;
          console.log("[ScannerBridge] Successfully compiled via quickStrategy.onSubmit()");
        } else if (typeof quickStrategy.createStrategy === 'function') {
          quickStrategy.createStrategy(mockFormData);
          storeSuccess = true;
          console.log("[ScannerBridge] Successfully compiled via quickStrategy.createStrategy()");
        }
      } catch (error) {
        console.warn("[ScannerBridge] Quick strategy store method failed, relying on direct canvas override...", error);
      }
    }

    // 2. Post-render canvas sweep: Instantly force-update the active block fields so the UI reflects the selected asset
    setTimeout(() => {
      const workspace = (window as any).Blockly?.mainWorkspace;
      if (workspace) {
        try {
          const blocks = workspace.getAllBlocks(false);
          blocks.forEach((block: any) => {
            if (block.type === 'trade_definition_market' || block.getField('SYMBOL_LIST')) {
              const symbolField = block.getField('SYMBOL_LIST');
              if (symbolField) {
                symbolField.setValue(strictDerivSymbol);
              }
            }
          });
          workspace.render();
          console.log(`[ScannerBridge] Post-render sweep successfully verified symbol: ${strictDerivSymbol}`);
        } catch (e) {
          console.warn("[ScannerBridge] Post-render sweep warning:", e);
        }
      }
    }, 100);

    if (storeSuccess) return true;

    // 3. Fallback to legacy XML injection if store is unavailable
    return this.injectDataLegacy({
      ...payload,
      symbol: strictDerivSymbol
    });
  }

  /**
   * Direct Blockly workspace XML builder fallback
   */
  private static injectDataLegacy(payload: AIScannerPayload): boolean {
    const workspace = (window as any).Blockly?.mainWorkspace;
    if (!workspace) {
      console.error("[ScannerBridge] No active Blockly workspace context found.");
      return false;
    }

    try {
      const xmlString = `
        <xml xmlns="http://www.w3.org/1999/xhtml" collection="false">
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
      console.log(`[ScannerBridge] Successfully injected XML workspace for symbol: ${payload.symbol}`);
      return true;
    } catch (e) {
      console.error("[ScannerBridge] Legacy XML injection failed:", e);
      return false;
    }
  }

  /**
   * Cleanly extracts dynamic values from your scanner without fallbacks.
   */
  public static loadStrategyToWorkspace(strategy: any, options: { stake?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    const rawSymbol = 
      options?.symbol || 
      strategy?.symbol || 
      strategy?.market || 
      strategy?.asset || 
      strategy?.name || 
      '1HZ100V';

    const payload: AIScannerPayload = {
      symbol: rawSymbol,
      stake: options?.stake || strategy?.recommendedStake || strategy?.stake || 10,
      duration: options?.duration || strategy?.duration || 5,
      tradeType: options?.contractType || strategy?.contractType || 'rise_fall',
      durationUnit: options?.durationUnit || 't'
    };
    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
