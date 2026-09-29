// src/Aiscanner/scannerBridge.ts
import { ASSET_TO_SYMBOL } from './useDerivTicks';
import { StrategyConfig, getAssetSymbol } from './strategies';

export class ScannerBridge {
  private ticksBuffer: Record<string, number[]> = {};
  private listeners: Array<(buffer: Record<string, number[]>) => void> = [];
  private isHooked = false;
  private activeWS: WebSocket | null = null;
  private subscribedSymbols = new Set<string>();

  public init() {
    if (this.isHooked) return;

    const globalWS =
      (window as any)._derivWebSocket ||
      (window as any).appWebSocket ||
      (window as any).ws;

    if (globalWS && typeof globalWS.addEventListener === 'function') {
      this.activeWS = globalWS;
      this.attachWSListener(globalWS);
      this.subscribeAllAssets();
      this.isHooked = true;
      return;
    }

    const NativeWebSocket = window.WebSocket;
    const self = this;

    window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
      const wsInstance = new NativeWebSocket(url, protocols);
      self.activeWS = wsInstance;
      self.attachWSListener(wsInstance);

      wsInstance.addEventListener('open', () => {
        self.subscribeAllAssets();
      });

      return wsInstance;
    } as any;

    window.WebSocket.prototype = NativeWebSocket.prototype;
    this.isHooked = true;
  }

  public subscribeAllAssets() {
    const sendSubscriptions = () => {
      if (!this.activeWS || this.activeWS.readyState !== WebSocket.OPEN) return;

      const symbols = Array.from(new Set(Object.values(ASSET_TO_SYMBOL)));
      
      symbols.forEach((symbol) => {
        if (!this.subscribedSymbols.has(symbol)) {
          this.subscribedSymbols.add(symbol);
          this.activeWS?.send(JSON.stringify({ ticks: symbol }));
        }
      });
    };

    if (this.activeWS && this.activeWS.readyState === WebSocket.OPEN) {
      sendSubscriptions();
    } else {
      setTimeout(sendSubscriptions, 1000);
    }
  }

  private attachWSListener(ws: WebSocket) {
    ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'tick' && data.tick) {
          const symbol = data.tick.symbol;
          const price = Number(data.tick.quote);
          if (symbol && !isNaN(price)) {
            this.pushTick(symbol, price);
          }
        }
      } catch (e) {
        // Drop non-JSON framing safely
      }
    });
  }

  public pushTick(symbol: string, price: number) {
    const currentSymbolTicks = this.ticksBuffer[symbol] || [];
    const updatedSymbolTicks = [...currentSymbolTicks, price].slice(-30);

    const mappedEntries: Record<string, number[]> = {
      [symbol]: updatedSymbolTicks,
    };

    Object.entries(ASSET_TO_SYMBOL).forEach(([assetName, sym]) => {
      if (sym === symbol) {
        mappedEntries[assetName] = updatedSymbolTicks;
      }
    });

    this.ticksBuffer = {
      ...this.ticksBuffer,
      ...mappedEntries,
    };

    this.notify();
  }

  public subscribe(cb: (buffer: Record<string, number[]>) => void) {
    this.listeners.push(cb);
    cb(this.ticksBuffer);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.ticksBuffer));
  }

  public getTicksBuffer() {
    return this.ticksBuffer;
  }

  /**
   * Generates the complete DBot XML template matching Deriv's exact block schema.
   */
  private buildBotXml(strategy: StrategyConfig, symbolCode: string): string {
    const targetDirection = strategy.direction === 'DOWN' ? 'DOWN' : 'UP';
    return `
      <xml xmlns="http://www.w3.org/1999/xhtml">
        <block type="trade_definition" id="trade_definition_block" x="20" y="20">
          <field name="MARKET_LIST">synthetic_index</field>
          <field name="SUBMARKET_LIST">random_index</field>
          <field name="SYMBOL_LIST">${symbolCode}</field>
          <field name="TRADETYPECAT_LIST">updown</field>
          <field name="TRADETYPE_LIST">risefall</field>
          <field name="TYPECAT_LIST">both</field>
          <field name="CANDLEINTERVAL_LIST">60</field>
          
          <statement name="INITIALIZATION">
            <block type="variables_set">
              <field name="VAR">target_profit</field>
              <value name="VALUE">
                <block type="math_number"><field name="NUM">${strategy.takeProfit}</field></block>
              </value>
              <next>
                <block type="variables_set">
                  <field name="VAR">stop_loss</field>
                  <value name="VALUE">
                    <block type="math_number"><field name="NUM">${strategy.stopLoss}</field></block>
                  </value>
                  <next>
                    <block type="variables_set">
                      <field name="VAR">martingale_size</field>
                      <value name="VALUE">
                        <block type="math_number"><field name="NUM">${strategy.martingaleMultiplier ?? 2.0}</field></block>
                      </value>
                    </block>
                  </next>
                </block>
              </next>
            </block>
          </statement>

          <statement name="SUBMARKET">
            <block type="trade_options" id="trade_options_block">
              <field name="DURATIONUNIT_LIST">t</field>
              <value name="DURATION">
                <block type="math_number"><field name="NUM">1</field></block>
              </value>
              <value name="AMOUNT">
                <block type="math_number"><field name="NUM">${strategy.stake ?? 1}</field></block>
              </value>
            </block>
          </statement>

          <statement name="SUBMARKET_PURCHASE">
            <block type="purchase" id="purchase_block">
              <field name="PURCHASE_LIST">${targetDirection}</field>
            </block>
          </statement>
        </block>
      </xml>
    `.trim();
  }

  /**
   * Clears the workspace and injects the new strategy XML so DBot renders the updated blocks instantly.
   */
  public injectDataToBlockly(strategy: StrategyConfig): boolean {
    const globalWin = window as any;
    const workspace =
      globalWin.Blockly?.getMainWorkspace?.() ||
      globalWin.DBot?.workspace ||
      globalWin.workspace;

    const BlocklyRef = globalWin.Blockly;

    if (!workspace) {
      console.error('[ScannerBridge] Blockly workspace is not currently open.');
      return false;
    }

    try {
      if (typeof workspace.clear === 'function') {
        workspace.clear();
      }

      const symbolCode = getAssetSymbol(strategy.asset);
      const xmlString = this.buildBotXml(strategy, symbolCode);

      if (BlocklyRef && BlocklyRef.Xml) {
        const dom = BlocklyRef.Xml.textToDom(xmlString);
        BlocklyRef.Xml.domToWorkspace(dom, workspace);
      } else {
        // Fallback parser if Blockly.Xml wrapper differs
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length === 0 && BlocklyRef?.Xml) {
          BlocklyRef.Xml.domToWorkspace(doc.documentElement, workspace);
        } else {
          return false;
        }
      }

      if (typeof workspace.render === 'function') {
        workspace.render();
      }

      return true;
    } catch (err) {
      console.error('[ScannerBridge] Failed to inject XML into Blockly workspace:', err);
      return false;
    }
  }
}

export const scannerBridge = new ScannerBridge();
