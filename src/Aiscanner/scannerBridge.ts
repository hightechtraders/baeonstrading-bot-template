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

  private configureRunOnceParameters(riskOptions: { stopLoss: number; takeProfit: number; martingaleMultiplier?: number }) {
    const globalWin = window as any;
    const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
    if (!workspace) return;

    try {
      const allBlocks = workspace.getAllBlocks(false);
      const multiplier = riskOptions.martingaleMultiplier || 2.1;

      allBlocks.forEach((block: any) => {
        if (block.type === 'run_once' || block.type.includes('run_once')) {
          let statementInput = block.getInput('DO') || block.getInput('STATEMENTS');
          if (!statementInput) return;

          let existingChild = statementInput.connection?.targetBlock();
          if (existingChild) {
            this.updateExistingRunOnceVariables(existingChild, riskOptions, multiplier);
            return;
          }

          ['Stop Loss', 'Take Profit', 'Martingale Multiplier'].forEach(varName => {
            if (workspace.getVariable && !workspace.getVariable(varName)) {
              if (workspace.createVariable) {
                workspace.createVariable(varName);
              }
            }
          });

          const xmlString = `
            <xml xmlns="http://www.w3.org/1999/xhtml">
              <block type="variables_set" x="0" y="0">
                <field name="VAR">Stop Loss</field>
                <value name="VALUE">
                  <block type="math_number">
                    <field name="NUM">${riskOptions.stopLoss}</field>
                  </block>
                </value>
                <next>
                  <block type="variables_set">
                    <field name="VAR">Take Profit</field>
                    <value name="VALUE">
                      <block type="math_number">
                        <field name="NUM">${riskOptions.takeProfit}</field>
                      </block>
                    </value>
                    <next>
                      <block type="variables_set">
                        <field name="VAR">Martingale Multiplier</field>
                        <value name="VALUE">
                          <block type="math_number">
                            <field name="NUM">${multiplier}</field>
                          </block>
                        </value>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </xml>
          `;

          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
          const domElement = xmlDoc.documentElement.children[0];

          if (domElement && globalWin.Blockly.Xml) {
            const newBlock = globalWin.Blockly.Xml.domToBlock(domElement, workspace);
            if (newBlock && statementInput.connection && newBlock.previousConnection) {
              statementInput.connection.connect(newBlock.previousConnection);
              workspace.fireChangeListener(new globalWin.Blockly.Events.BlockCreate(newBlock));
            }
          }
        }
      });
    } catch (err) {
      console.error('[AI Scanner] Error building run-once parameters:', err);
    }
  }

  private updateExistingRunOnceVariables(firstBlock: any, riskOptions: { stopLoss: number; takeProfit: number }, multiplier: number) {
    let current = firstBlock;
    while (current) {
      if (current.type === 'variables_set') {
        const varField = current.getField('VAR');
        const varName = varField ? varField.getText().toLowerCase() : '';
        const targetInput = current.getInput('VALUE');
        const numBlock = targetInput?.connection?.targetBlock();
        const numField = numBlock?.getField('NUM');

        if (numField) {
          if (varName.includes('stop') || varName.includes('loss')) {
            numField.setValue(String(riskOptions.stopLoss));
          } else if (varName.includes('profit') || varName.includes('target')) {
            numField.setValue(String(riskOptions.takeProfit));
          } else if (varName.includes('multiplier') || varName.includes('martingale')) {
            numField.setValue(String(multiplier));
          }
        }
      }
      current = current.getNextBlock();
    }
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; takeProfit?: number; duration?: number; symbol?: string; contractType?: string; [key: string]: any }) {
    console.log(`[AI Scanner] Loading strategy:`, strategy, options);

    const globalWin = window as any;
    const config = this.resolveMarketConfig(options.symbol || strategy.market || strategy.volatility);
    const direction = strategy.direction || 'UP';
    const targetContract = options.contractType || (direction === 'UP' ? 'CALL' : 'PUT');
    const safeDuration = options.duration !== undefined ? Math.min(Math.max(options.duration, 1), 10) : 5;
    const safeStake = options.stake !== undefined ? options.stake : (strategy.recommendedStake || 10);
    const safeStopLoss = options.stopLoss !== undefined ? options.stopLoss : (strategy.recommendedStopLoss || 20);
    const safeTakeProfit = options.takeProfit !== undefined ? options.takeProfit : (strategy.recommendedTakeProfit || 50);

    globalWin.tredapendingParams = { ...options, duration: safeDuration, stake: safeStake, stopLoss: safeStopLoss, takeProfit: safeTakeProfit, ...config, contractType: targetContract, strategy };

    setTimeout(() => {
      const workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
      if (!workspace) return;

      try {
        const allBlocks = workspace.getAllBlocks(false);

        allBlocks.forEach((block: any) => {
          // Target trade_definition and child sub-blocks/market blocks where symbol dropdowns reside
          if (block.type === 'trade_definition' || block.type === 'trade_definition_market' || block.type.includes('market')) {
            try {
              block.setFieldValue(config.market, 'MARKET_LIST');
              block.setFieldValue(config.submarket, 'SUBMARKET_LIST');
              
              const symbolField = block.getField('SYMBOL_LIST');
              if (symbolField) {
                if (typeof symbolField.menuGenerator_ === 'function') {
                  const opts = symbolField.menuGenerator_();
                  if (Array.isArray(opts) && !opts.some((o: any) => o[1] === config.symbol)) {
                    opts.push([config.symbol, config.symbol]);
                  }
                }
                symbolField.setValue(config.symbol);
                if (typeof symbolField.forceRerender === 'function') {
                  symbolField.forceRerender();
                }
              }

              block.setFieldValue('callput', 'TRADE_TYPE_LIST');
            } catch (e) {
              console.warn('[AI Scanner] Market update warning:', e);
            }
          }

          if (block.type === 'purchase' || block.type.includes('purchase')) {
            const purchaseField = block.getField('PURCHASE_LIST') || block.getField('CONTRACT_TYPE');
            if (purchaseField) {
              purchaseField.setValue(targetContract);
            }
          }

          if (block.type.includes('trade') || block.type.includes('amount') || block.type.includes('option')) {
            ['AMOUNT', 'VALUE', 'NUM', 'STAKE', 'DURATION'].forEach(fieldName => {
              const field = block.getField(fieldName);
              if (field) {
                if (fieldName === 'DURATION') {
                  field.setValue(String(safeDuration));
                } else {
                  field.setValue(String(safeStake));
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
                  }
                });
              }
            });
          }
        });

        this.configureRunOnceParameters({
          stopLoss: safeStopLoss,
          takeProfit: safeTakeProfit,
          martingaleMultiplier: 2.1
        });

        workspace.fireChangeListener(new globalWin.Blockly.Events.BlockChange(null, 'edit', '', {}, {}));
        console.log(`[AI Scanner] Successfully loaded and aligned strategy parameters.`);
      } catch (err) {
        console.error('[AI Scanner] Error loading workspace blocks:', err);
      }
    }, 600);
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
