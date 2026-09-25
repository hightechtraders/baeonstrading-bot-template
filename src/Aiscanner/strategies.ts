// src/Aiscanner/strategies.ts

export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface StrategyConfig {
  id: string;
  name: string;
  asset: string;
  tradeType: string;
  riskModel: string;
  priority: PriorityLevel;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  description: string;
  score?: number;
  confidence?: number;
  direction?: 'UP' | 'DOWN' | 'HOLD';
}

export interface StrategySignal {
  strategyId: string;
  direction: 'UP' | 'DOWN' | 'HOLD';
  confidence: number;
  score: number;
  timestamp: number;
}

export const CORE_7_STRATEGIES: StrategyConfig[] = [
  {
    id: 'strat-1',
    name: '#1 AI Adaptive',
    asset: 'Volatility 25',
    tradeType: 'Rise / Fall',
    riskModel: 'NEURAL_FLOW',
    priority: 'HIGH',
    stake: 3,
    stopLoss: 4,
    takeProfit: 8,
    description: 'Neural Flow structural strategy designed for Volatility 25.',
  },
  {
    id: 'strat-2',
    name: '#2 1-3-2-6 System',
    asset: 'Volatility 10',
    tradeType: 'Rise / Fall',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 2,
    stopLoss: 5,
    takeProfit: 10,
    description: 'Progressive staking system designed for Volatility 10.',
  },
  {
    id: 'strat-3',
    name: '#3 Hyper Scalper Engine v26',
    asset: 'Volatility 10',
    tradeType: 'Rise / Fall',
    riskModel: 'MARTINGALE',
    priority: 'MEDIUM',
    stake: 1,
    stopLoss: 10,
    takeProfit: 15,
    description: 'Martingale scalp strategy designed for Volatility 10.',
  },
  {
    id: 'strat-4',
    name: '#4 AI Balanced',
    asset: 'Volatility 50',
    tradeType: 'Over / Under',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 5,
    stopLoss: 10,
    takeProfit: 20,
    description: 'Balanced digit strategy designed for Volatility 50.',
  },
  {
    id: 'strat-5',
    name: '#5 Momentum Breakout',
    asset: 'Volatility 75',
    tradeType: 'Rise / Fall',
    riskModel: 'TICK_MOMENTUM',
    priority: 'MEDIUM',
    stake: 2,
    stopLoss: 6,
    takeProfit: 12,
    description: 'Breakout tick strategy designed for Volatility 75.',
  },
  {
    id: 'strat-6',
    name: '#6 High-Frequency Scalp',
    asset: 'Volatility 100 (1s)',
    tradeType: 'Rise / Fall',
    riskModel: 'NEURAL_FLOW',
    priority: 'MEDIUM',
    stake: 4,
    stopLoss: 8,
    takeProfit: 16,
    description: 'Fast-cycle neural model designed for Volatility 100 (1s).',
  },
  {
    id: 'strat-7',
    name: '#7 Conservative Grid',
    asset: 'Volatility 100',
    tradeType: 'Over / Under',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 1,
    stopLoss: 3,
    takeProfit: 6,
    description: 'Low-risk step model designed for Volatility 100.',
  },
];

export function enforceSingleHighPriority(
  strategies: StrategyConfig[],
  highStrategyId?: string
): StrategyConfig[] {
  const targetId = highStrategyId || strategies[0]?.id;

  return strategies.map((strat) => ({
    ...strat,
    priority: strat.id === targetId ? 'HIGH' : 'MEDIUM',
  }));
}

export function evaluateStrategySignal(
  strategy: StrategyConfig,
  ticks: number[]
): { direction: 'UP' | 'DOWN' | 'HOLD'; confidence: number; score: number } {
  if (!ticks || ticks.length < 5) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  const recent = ticks.slice(-10);
  const gains = recent.slice(1).filter((val, i) => val > recent[i]).length;
  const total = recent.length - 1;

  const score = Math.round((gains / total) * 100);
  let direction: 'UP' | 'DOWN' | 'HOLD' = 'HOLD';

  if (score >= 65) direction = 'UP';
  else if (score <= 35) direction = 'DOWN';

  const confidence = Math.max(score, 100 - score);

  return { direction, confidence, score };
}

/**
 * Updates active workspace parameters IN-PLACE without ever clearing the canvas.
 */
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
  };

  const symbol = symbolMap[strategy.asset] || '1HZ100V';
  const purchaseType = strategy.direction === 'DOWN' ? 'FALL' : 'RISE';

  try {
    // 1. Pause events during batch updates to prevent flickering
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    // 2. Market Symbol Update
    const marketBlock =
      workspace.getBlockById('trade_definition_market') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_market')[0]);
    if (marketBlock && typeof marketBlock.setFieldValue === 'function') {
      marketBlock.setFieldValue(symbol, 'SYMBOL_LIST');
    }

    // 3. Stake Amount Update
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

    // 4. Direction Update (Rise / Fall)
    const purchaseBlocks = workspace.getBlocksByType ? workspace.getBlocksByType('purchase') : [];
    if (purchaseBlocks.length > 0) {
      purchaseBlocks.forEach((pBlock: any) => {
        if (typeof pBlock.setFieldValue === 'function') {
          pBlock.setFieldValue(purchaseType, 'PURCHASE_LIST');
        }
      });
    }

    // 5. Inspect existing set_variable blocks across workspace
    const allBlocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    let foundTPBlock: any = null;
    let foundSLBlock: any = null;

    allBlocks.forEach((block: any) => {
      if (block.type === 'variables_set') {
        const varId = block.getFieldValue('VAR');
        const varModel = workspace.getVariableById
          ? workspace.getVariableById(varId)
          : workspace.getVariableMap
          ? workspace.getVariableMap().getVariableById(varId)
          : null;
        const varName = varModel ? varModel.name.toLowerCase() : '';

        if (varName.includes('profit') || varName.includes('tp') || block.id === 'init_tp') {
          foundTPBlock = block;
        } else if (varName.includes('loss') || varName.includes('sl') || block.id === 'init_sl') {
          foundSLBlock = block;
        } else if (varName.includes('stake') || block.id === 'init_stake') {
          const valueInput = block.getInput('VALUE');
          if (valueInput && valueInput.connection && valueInput.connection.targetBlock()) {
            const numBlock = valueInput.connection.targetBlock();
            if (typeof numBlock.setFieldValue === 'function') {
              numBlock.setFieldValue(strategy.stake.toString(), 'NUM');
            }
          }
        }
      }
    });

    // Helper to safely update a numeric input connected to a variables_set block
    const setNumValue = (varSetBlock: any, val: number) => {
      if (!varSetBlock) return;
      const valueInput = varSetBlock.getInput('VALUE');
      if (valueInput && valueInput.connection && valueInput.connection.targetBlock()) {
        const numBlock = valueInput.connection.targetBlock();
        if (typeof numBlock.setFieldValue === 'function') {
          numBlock.setFieldValue(val.toString(), 'NUM');
        }
      }
    };

    if (foundTPBlock) setNumValue(foundTPBlock, strategy.takeProfit);
    if (foundSLBlock) setNumValue(foundSLBlock, strategy.stopLoss);

    // 6. TARGETED FIX: Query trade_definition root block directly
    const rootTradeBlock =
      workspace.getBlockById('trade_definition') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition')[0]);

    if (rootTradeBlock && (!foundTPBlock || !foundSLBlock)) {
      const initInput = rootTradeBlock.getInput('INITIALIZATION');

      if (initInput && initInput.connection) {
        const createAndAttachVarBlock = (varName: string, value: number) => {
          // Get or create variable in DBot workspace
          let variable = workspace.getVariableMap
            ? workspace.getVariableMap().getVariable(varName)
            : null;

          if (!variable && typeof workspace.createVariable === 'function') {
            variable = workspace.createVariable(varName);
          }
          if (!variable) return null;

          // Create variables_set block
          const setVarBlock = workspace.newBlock('variables_set');
          setVarBlock.setFieldValue(variable.getId(), 'VAR');

          // Create math_number block
          const numBlock = workspace.newBlock('math_number');
          numBlock.setFieldValue(value.toString(), 'NUM');

          // Attach number block to variables_set VALUE input
          const valInput = setVarBlock.getInput('VALUE');
          if (valInput && valInput.connection && numBlock.outputConnection) {
            valInput.connection.connect(numBlock.outputConnection);
          }

          if (typeof setVarBlock.initSvg === 'function') setVarBlock.initSvg();
          if (typeof numBlock.initSvg === 'function') numBlock.initSvg();

          return setVarBlock;
        };

        const newTPBlock = !foundTPBlock ? createAndAttachVarBlock('target_profit', strategy.takeProfit) : null;
        const newSLBlock = !foundSLBlock ? createAndAttachVarBlock('stop_loss', strategy.stopLoss) : null;

        // Snap newly created blocks inside INITIALIZATION slot
        const existingChild = initInput.connection.targetBlock();
        let targetSlot = initInput.connection;

        if (existingChild) {
          let tail = existingChild;
          while (tail.nextConnection && tail.nextConnection.targetBlock()) {
            tail = tail.nextConnection.targetBlock();
          }
          targetSlot = tail.nextConnection;
        }

        if (newTPBlock && targetSlot) {
          targetSlot.connect(newTPBlock.previousConnection);
          if (newSLBlock && newTPBlock.nextConnection) {
            newTPBlock.nextConnection.connect(newSLBlock.previousConnection);
          }
        } else if (newSLBlock && targetSlot) {
          targetSlot.connect(newSLBlock.previousConnection);
        }
      }
    }

    // 7. Re-enable events and trigger render frame
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
    console.error('[Strategies] In-place strategy application failed:', error);
    return false;
  }
}

/**
 * Exported for XML compatibility.
 */
export function generateDBotXml(strategy: StrategyConfig): string {
  const symbolMap: Record<string, string> = {
    'Volatility 10': 'R_10',
    'Volatility 25': 'R_25',
    'Volatility 50': 'R_50',
    'Volatility 75': 'R_75',
    'Volatility 100': 'R_100',
    'Volatility 100 (1s)': '1HZ100V',
    'Volatility 25 (1s)': '1HZ25V',
  };

  const symbol = symbolMap[strategy.asset] || '1HZ100V';
  const purchaseType = strategy.direction === 'DOWN' ? 'FALL' : 'RISE';

  return `
<xml xmlns="https://developers.google.com/blockly/xml">
  <variables>
    <variable id="stake_var">stake</variable>
    <variable id="tp_var">target_profit</variable>
    <variable id="sl_var">stop_loss</variable>
  </variables>
  <block type="trade_definition" id="trade_definition" deletable="false" x="40" y="40">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="trade_definition_market" deletable="false">
        <field name="MARKET_LIST">synthetic_index</field>
        <field name="SUBMARKET_LIST">random_index</field>
        <field name="SYMBOL_LIST">${symbol}</field>
        <next>
          <block type="trade_definition_tradetype" id="trade_definition_tradetype" deletable="false">
            <field name="TRADETYPECAT_LIST">risefall</field>
            <field name="TRADETYPE_LIST">risefall</field>
            <next>
              <block type="trade_definition_contracttype" id="trade_definition_contracttype" deletable="false">
                <field name="TYPE_LIST">both</field>
                <next>
                  <block type="trade_definition_candleinterval" id="trade_definition_candleinterval" deletable="false">
                    <field name="CANDLEINTERVAL_LIST">60</field>
                    <next>
                      <block type="trade_definition_restartbuystrat" id="trade_definition_restartbuystrat" deletable="false">
                        <field name="TIME_MACHINE_ENABLED">FALSE</field>
                        <next>
                          <block type="trade_definition_restartonerror" id="trade_definition_restartonerror" deletable="false">
                            <field name="RESTARTONERROR">FALSE</field>
                          </block>
                        </next>
                      </block>
                    </next>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="INITIALIZATION">
      <block type="variables_set" id="init_stake">
        <field name="VAR" id="stake_var">stake</field>
        <value name="VALUE">
          <shadow type="math_number" id="shadow_stake">
            <field name="NUM">${strategy.stake}</field>
          </shadow>
        </value>
        <next>
          <block type="variables_set" id="init_tp">
            <field name="VAR" id="tp_var">target_profit</field>
            <value name="VALUE">
              <shadow type="math_number" id="shadow_tp">
                <field name="NUM">${strategy.takeProfit}</field>
              </shadow>
            </value>
            <next>
              <block type="variables_set" id="init_sl">
                <field name="VAR" id="sl_var">stop_loss</field>
                <value name="VALUE">
                  <shadow type="math_number" id="shadow_sl">
                    <field name="NUM">${strategy.stopLoss}</field>
                  </shadow>
                </value>
              </block>
            </next>
          </block>
        </next>
      </block>
    </statement>
    <statement name="SUBMARKET">
      <block type="trade_definition_tradeoptions" id="trade_definition_tradeoptions" deletable="false">
        <mutation has_first_barrier="false" has_second_barrier="false" has_prediction="false"></mutation>
        <field name="DURATION_TYPE_LIST">t</field>
        <field name="CURRENCY_LIST">USD</field>
        <field name="AMOUNT_TYPE_LIST">stake</field>
        <value name="DURATION">
          <shadow type="math_number" id="duration_num">
            <field name="NUM">1</field>
          </shadow>
        </value>
        <value name="AMOUNT">
          <shadow type="math_number" id="amount_num">
            <field name="NUM">${strategy.stake}</field>
          </shadow>
        </value>
      </block>
    </statement>
  </block>
  <block type="before_purchase" id="before_purchase" deletable="false" x="40" y="560">
    <statement name="BEFOREPURCHASE_STACK">
      <block type="purchase" id="purchase_block">
        <field name="PURCHASE_LIST">${purchaseType}</field>
      </block>
    </statement>
  </block>
  <block type="during_purchase" id="during_purchase" deletable="false" x="40" y="680"></block>
  <block type="after_purchase" id="after_purchase" deletable="false" x="40" y="780">
    <statement name="AFTERPURCHASE_STACK">
      <block type="trade_again" id="trade_again_block"></block>
    </statement>
  </block>
</xml>
  `.trim();
}
