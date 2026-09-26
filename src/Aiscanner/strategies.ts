export interface StrategyConfig {
  id: string;
  name: string;
  description: string;
  asset: string;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  direction: 'UP' | 'DOWN';
  status: 'ACTIVE' | 'PAUSED';
  martingaleMultiplier?: number;
}

export interface StrategySignal {
  confidence: number;
  direction: 'UP' | 'DOWN';
}

// 1. Export CORE_7_STRATEGIES
export const CORE_7_STRATEGIES: StrategyConfig[] = [
  {
    id: 'strat-1',
    name: 'Momentum Scalper',
    description: 'High-frequency tick momentum tracking on Volatility 100 (1s)',
    asset: 'Volatility 100 (1s)',
    stake: 10,
    stopLoss: 50,
    takeProfit: 100,
    confidence: 88,
    priority: 'HIGH',
    direction: 'UP',
    status: 'ACTIVE',
    martingaleMultiplier: 2.15,
  },
  {
    id: 'strat-2',
    name: 'Mean Reversion',
    description: 'Overbought/oversold reversal detector for Volatility 75',
    asset: 'Volatility 75',
    stake: 5,
    stopLoss: 25,
    takeProfit: 50,
    confidence: 74,
    priority: 'MEDIUM',
    direction: 'DOWN',
    status: 'ACTIVE',
    martingaleMultiplier: 2.0,
  },
  {
    id: 'strat-3',
    name: 'Breakout Trader',
    description: 'Volatility expansion scanner across Volatility 50',
    asset: 'Volatility 50',
    stake: 15,
    stopLoss: 45,
    takeProfit: 90,
    confidence: 65,
    priority: 'LOW',
    direction: 'UP',
    status: 'ACTIVE',
    martingaleMultiplier: 2.15,
  },
  {
    id: 'strat-4',
    name: 'Trend Follower',
    description: 'Sustained micro-trend analyzer on Volatility 25 (1s)',
    asset: 'Volatility 25 (1s)',
    stake: 10,
    stopLoss: 30,
    takeProfit: 60,
    confidence: 60,
    priority: 'LOW',
    direction: 'UP',
    status: 'ACTIVE',
    martingaleMultiplier: 2.15,
  },
  {
    id: 'strat-5',
    name: 'Range Bound',
    description: 'Support & resistance bounce targeter on Volatility 10',
    asset: 'Volatility 10',
    stake: 5,
    stopLoss: 20,
    takeProfit: 40,
    confidence: 55,
    priority: 'LOW',
    direction: 'DOWN',
    status: 'ACTIVE',
    martingaleMultiplier: 2.0,
  },
  {
    id: 'strat-6',
    name: 'Tick Differential',
    description: 'Rapid directional delta engine on Volatility 100',
    asset: 'Volatility 100',
    stake: 20,
    stopLoss: 60,
    takeProfit: 120,
    confidence: 50,
    priority: 'LOW',
    direction: 'UP',
    status: 'ACTIVE',
    martingaleMultiplier: 2.2,
  },
  {
    id: 'strat-7',
    name: 'Volatility Pulse',
    description: 'Dynamic volatility burst indicator on Volatility 25',
    asset: 'Volatility 25',
    stake: 10,
    stopLoss: 35,
    takeProfit: 70,
    confidence: 45,
    priority: 'LOW',
    direction: 'DOWN',
    status: 'ACTIVE',
    martingaleMultiplier: 2.0,
  },
];

// 2. Export enforceSingleHighPriority
export function enforceSingleHighPriority(
  strategies: StrategyConfig[],
  targetHighId?: string
): StrategyConfig[] {
  const chosenHighId = targetHighId || strategies[0]?.id;
  return strategies.map((s) => ({
    ...s,
    priority: s.id === chosenHighId ? 'HIGH' : 'LOW',
  }));
}

// 3. Export evaluateStrategySignal
export function evaluateStrategySignal(
  strategy: StrategyConfig,
  ticks: number[]
): StrategySignal {
  if (!ticks || ticks.length < 2) {
    return { confidence: strategy.confidence, direction: strategy.direction };
  }

  const last = ticks[ticks.length - 1];
  const prev = ticks[ticks.length - 2];
  const diff = last - prev;

  const dynamicConf = Math.min(
    99,
    Math.max(30, Math.round(strategy.confidence + (diff !== 0 ? (diff > 0 ? 2 : -2) : 0)))
  );

  return {
    confidence: dynamicConf,
    direction: diff >= 0 ? 'UP' : 'DOWN',
  };
}

// 4. Export applyStrategyToWorkspace
export function applyStrategyToWorkspace(workspace: any, strategy: StrategyConfig): boolean {
  if (!workspace) return false;

  const symbolMap: Record<string, string> = {
    'Volatility 10': 'R_10',
    'Volatility 25': 'R_25',
    'Volatility 50': 'R_50',
    'Volatility 75': 'R_75',
    'Volatility 100': 'R_100',
    'Volatility 100 (1s)': '1HZ100V',
    'Volatility 25 (1s)': '1HZ25V',
    'Volatility 10 Index': 'R_10',
    'Volatility 25 Index': 'R_25',
    'Volatility 50 Index': 'R_50',
    'Volatility 75 Index': 'R_75',
    'Volatility 100 Index': 'R_100',
    'Volatility 100 (1s) Index': '1HZ100V',
    'Volatility 25 (1s) Index': '1HZ25V',
  };

  const symbol = symbolMap[strategy.asset] || '1HZ100V';
  const purchaseType = strategy.direction === 'DOWN' ? 'FALL' : 'RISE';
  const multiplier = strategy.martingaleMultiplier ?? 2.15;

  try {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    ['stake', 'target_profit', 'stop_loss', 'martingale_multiplier'].forEach((varName) => {
      let variable = workspace.getVariableMap
        ? workspace.getVariableMap().getVariable(varName)
        : null;
      if (!variable && typeof workspace.createVariable === 'function') {
        workspace.createVariable(varName);
      }
    });

    const marketBlock =
      workspace.getBlockById('trade_definition_market') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_market')[0]);

    if (marketBlock && typeof marketBlock.setFieldValue === 'function') {
      const is1s = symbol.startsWith('1HZ');
      marketBlock.setFieldValue('synthetic_index', 'MARKET_LIST');
      marketBlock.setFieldValue(is1s ? '1hz_index' : 'random_index', 'SUBMARKET_LIST');
      marketBlock.setFieldValue(symbol, 'SYMBOL_LIST');
    }

    const tradeOptionsBlock =
      workspace.getBlockById('trade_definition_tradeoptions') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_tradeoptions')[0]);

    if (tradeOptionsBlock) {
      const amountInput = tradeOptionsBlock.getInput('AMOUNT');
      if (amountInput && amountInput.connection && amountInput.connection.targetBlock()) {
        const shadowBlock = amountInput.connection.targetBlock();
        if (typeof shadowBlock.setFieldValue === 'function') {
          shadowBlock.setFieldValue(strategy.stake.toString(), 'NUM');
        }
      }
    }

    const rootTradeBlock =
      workspace.getBlockById('trade_definition') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition')[0]);

    if (rootTradeBlock) {
      const initInput = rootTradeBlock.getInput('INITIALIZATION');
      if (initInput && initInput.connection) {
        const existingChild = initInput.connection.targetBlock();
        if (existingChild && typeof existingChild.dispose === 'function') {
          existingChild.dispose(false);
        }

        const block1Xml = `
          <xml xmlns="https://developers.google.com/blockly/xml">
            <block type="variables_set">
              <field name="VAR">stake</field>
              <value name="VALUE">
                <block type="math_number">
                  <field name="NUM">${strategy.stake}</field>
                </block>
              </value>
              <next>
                <block type="variables_set">
                  <field name="VAR">target_profit</field>
                  <value name="VALUE">
                    <block type="math_number">
                      <field name="NUM">${strategy.takeProfit}</field>
                    </block>
                  </value>
                  <next>
                    <block type="variables_set">
                      <field name="VAR">stop_loss</field>
                      <value name="VALUE">
                        <block type="math_number">
                          <field name="NUM">${strategy.stopLoss}</field>
                        </block>
                      </value>
                      <next>
                        <block type="variables_set">
                          <field name="VAR">martingale_multiplier</field>
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
              </next>
            </block>
          </xml>
        `;

        const parsedDom = (window as any).Blockly.Xml.textToDom(block1Xml);
        const firstBlock = (window as any).Blockly.Xml.domToBlock(parsedDom.firstElementChild, workspace);

        if (firstBlock && firstBlock.previousConnection) {
          initInput.connection.connect(firstBlock.previousConnection);
        }
      }
    }

    const purchaseBlocks = workspace.getBlocksByType ? workspace.getBlocksByType('purchase') : [];
    purchaseBlocks.forEach((pBlock: any) => {
      if (typeof pBlock.setFieldValue === 'function') {
        pBlock.setFieldValue(purchaseType, 'PURCHASE_LIST');
      }
    });

    const afterPurchaseBlock =
      workspace.getBlockById('after_purchase') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('after_purchase')[0]);

    if (afterPurchaseBlock) {
      const afterInput = afterPurchaseBlock.getInput('AFTERPURCHASE_STACK');

      if (afterInput && afterInput.connection) {
        const topChild = afterInput.connection.targetBlock();
        if (topChild && typeof topChild.dispose === 'function') {
          topChild.dispose(false);
        }

        const block4Xml = `
          <xml xmlns="https://developers.google.com/blockly/xml">
            <block type="controls_if">
              <mutation else="1"></mutation>
              <value name="IF0">
                <block type="contract_check_result">
                  <field name="CHECK_RESULT">win</field>
                </block>
              </value>
              <statement name="DO0">
                <block type="variables_set">
                  <field name="VAR">stake</field>
                  <value name="VALUE">
                    <block type="math_number">
                      <field name="NUM">${strategy.stake}</field>
                    </block>
                  </value>
                </block>
              </statement>
              <statement name="ELSE">
                <block type="variables_set">
                  <field name="VAR">stake</field>
                  <value name="VALUE">
                    <block type="math_arithmetic">
                      <field name="OP">MULTIPLY</field>
                      <value name="A">
                        <block type="variables_get">
                          <field name="VAR">stake</field>
                        </block>
                      </value>
                      <value name="B">
                        <block type="variables_get">
                          <field name="VAR">martingale_multiplier</field>
                        </block>
                      </value>
                    </block>
                  </value>
                </block>
              </statement>
              <next>
                <block type="trade_again"></block>
              </next>
            </block>
          </xml>
        `;

        const parsedDom = (window as any).Blockly.Xml.textToDom(block4Xml);
        const newBlock = (window as any).Blockly.Xml.domToBlock(parsedDom.firstElementChild, workspace);

        if (newBlock && newBlock.previousConnection) {
          afterInput.connection.connect(newBlock.previousConnection);
        }
      }
    }

    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(true);
    }
    if (typeof workspace.render === 'function') {
      workspace.render();
    }

    return true;
  } catch (error) {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(true);
    }
    console.error('[Strategies] Strategy application failed:', error);
    return false;
  }
}
