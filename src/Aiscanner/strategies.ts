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

/**
 * Dynamic momentum & tick velocity score evaluator.
 * Prevents static HOLD / 50% values by continuously computing trend direction across ticks.
 */
export function evaluateStrategySignal(
  strategy: StrategyConfig,
  ticks: number[]
): { direction: 'UP' | 'DOWN' | 'HOLD'; confidence: number; score: number } {
  if (!ticks || ticks.length < 3) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  const latestPrice = ticks[ticks.length - 1];
  const prevPrice = ticks[ticks.length - 2];
  const firstPrice = ticks[0];

  const tickDiff = latestPrice - prevPrice;
  const overallDiff = latestPrice - firstPrice;

  let gains = 0;
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i] > ticks[i - 1]) gains++;
  }
  const totalSteps = ticks.length - 1;
  const gainRatio = totalSteps > 0 ? gains / totalSteps : 0.5;

  let rawScore = gainRatio * 100;

  if (tickDiff > 0) rawScore += 5;
  if (tickDiff < 0) rawScore -= 5;

  const score = Math.max(10, Math.min(98, Math.round(rawScore)));

  let direction: 'UP' | 'DOWN' | 'HOLD' = 'HOLD';
  if (score >= 52 || tickDiff > 0 || overallDiff > 0) {
    direction = 'UP';
  } else if (score <= 48 || tickDiff < 0 || overallDiff < 0) {
    direction = 'DOWN';
  }

  const confidence = Math.max(score, 100 - score);

  return { direction, confidence, score };
}

/**
 * Updates active workspace parameters IN-PLACE without ever clearing the canvas or breaking Blockly structure.
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
  const martingaleMultiplier = 2.15; // Factor required to cover ~89% payout fee and make profit

  try {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    // 1. Market Symbol Update
    const marketBlock =
      workspace.getBlockById('trade_definition_market') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_market')[0]);
    if (marketBlock && typeof marketBlock.setFieldValue === 'function') {
      marketBlock.setFieldValue(symbol, 'SYMBOL_LIST');
    }

    // 2. Stake Amount Input (Link to Stake variable)
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

    // 3. Purchase Direction Update
    const purchaseBlocks = workspace.getBlocksByType ? workspace.getBlocksByType('purchase') : [];
    if (purchaseBlocks.length > 0) {
      purchaseBlocks.forEach((pBlock: any) => {
        if (typeof pBlock.setFieldValue === 'function') {
          pBlock.setFieldValue(purchaseType, 'PURCHASE_LIST');
        }
      });
    }

    // 4. Set Initial Variables in Workspace
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

    const allBlocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    let foundTPBlock: any = null;
    let foundSLBlock: any = null;
    let foundStakeBlock: any = null;

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
          foundStakeBlock = block;
        }
      }
    });

    if (foundTPBlock) setNumValue(foundTPBlock, strategy.takeProfit);
    if (foundSLBlock) setNumValue(foundSLBlock, strategy.stopLoss);
    if (foundStakeBlock) setNumValue(foundStakeBlock, strategy.stake);

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
 * Clean XML generator with full Block 1 and Block 4 filled with recovery & risk parameters.
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
  const martingaleFactor = 2.15;

  return `
<xml xmlns="https://developers.google.com/blockly/xml">
  <variables>
    <variable id="initial_stake_var">initial_stake</variable>
    <variable id="stake_var">stake</variable>
    <variable id="martingale_var">martingale_factor</variable>
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
      <!-- 1. Set initial_stake -->
      <block type="variables_set" id="init_initial_stake">
        <field name="VAR" id="initial_stake_var">initial_stake</field>
        <value name="VALUE">
          <shadow type="math_number" id="shadow_initial_stake">
            <field name="NUM">${strategy.stake}</field>
          </shadow>
        </value>
        <next>
          <!-- 2. Set current stake -->
          <block type="variables_set" id="init_stake">
            <field name="VAR" id="stake_var">stake</field>
            <value name="VALUE">
              <shadow type="math_number" id="shadow_stake">
                <field name="NUM">${strategy.stake}</field>
              </shadow>
            </value>
            <next>
              <!-- 3. Set martingale multiplier factor -->
              <block type="variables_set" id="init_martingale">
                <field name="VAR" id="martingale_var">martingale_factor</field>
                <value name="VALUE">
                  <shadow type="math_number" id="shadow_martingale">
                    <field name="NUM">${martingaleFactor}</field>
                  </shadow>
                </value>
                <next>
                  <!-- 4. Set target profit -->
                  <block type="variables_set" id="init_tp">
                    <field name="VAR" id="tp_var">target_profit</field>
                    <value name="VALUE">
                      <shadow type="math_number" id="shadow_tp">
                        <field name="NUM">${strategy.takeProfit}</field>
                      </shadow>
                    </value>
                    <next>
                      <!-- 5. Set stop loss -->
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
          <block type="variables_get" id="stake_amount_get">
            <field name="VAR" id="stake_var">stake</field>
          </block>
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
  
  <!-- BLOCK 4: Restart Trading Conditions with Martingale & TP/SL Checks -->
  <block type="after_purchase" id="after_purchase" deletable="false" x="40" y="780">
    <statement name="AFTERPURCHASE_STACK">
      <block type="controls_if" id="check_result_if">
        <mutation else="1"></mutation>
        <value name="IF0">
          <block type="contract_check_result" id="check_result">
            <field name="CHECK_RESULT">win</field>
          </block>
        </value>
        <statement name="DO0">
          <!-- Reset stake to initial_stake on Win -->
          <block type="variables_set" id="reset_stake_on_win">
            <field name="VAR" id="stake_var">stake</field>
            <value name="VALUE">
              <block type="variables_get" id="get_initial_stake">
                <field name="VAR" id="initial_stake_var">initial_stake</field>
              </block>
            </value>
          </block>
        </statement>
        <statement name="ELSE">
          <!-- Multiply stake by martingale_factor on Loss -->
          <block type="variables_set" id="multiply_stake_on_loss">
            <field name="VAR" id="stake_var">stake</field>
            <value name="VALUE">
              <block type="math_arithmetic" id="mult_stake">
                <field name="OP">MULTIPLY</field>
                <value name="A">
                  <block type="variables_get" id="get_current_stake">
                    <field name="VAR" id="stake_var">stake</field>
                  </block>
                </value>
                <value name="B">
                  <block type="variables_get" id="get_martingale_factor">
                    <field name="VAR" id="martingale_var">martingale_factor</field>
                  </block>
                </value>
              </block>
            </value>
          </block>
        </statement>
        <next>
          <!-- Stop Loss and Take Profit evaluation -->
          <block type="controls_if" id="evaluate_limits_if">
            <mutation elseif="1" else="1"></mutation>
            <value name="IF0">
              <block type="logic_compare" id="tp_check">
                <field name="OP">GTE</field>
                <value name="A">
                  <block type="total_profit" id="get_total_profit_tp"></block>
                </value>
                <value name="B">
                  <block type="variables_get" id="get_tp_var">
                    <field name="VAR" id="tp_var">target_profit</field>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO0">
              <block type="text_print" id="tp_reached_msg">
                <value name="TEXT">
                  <shadow type="text" id="tp_msg_text">
                    <field name="TEXT">Target Profit Reached!</field>
                  </shadow>
                </value>
              </block>
            </statement>
            <value name="IF1">
              <block type="logic_compare" id="sl_check">
                <field name="OP">LTE</field>
                <value name="A">
                  <block type="total_profit" id="get_total_profit_sl"></block>
                </value>
                <value name="B">
                  <block type="math_single" id="negate_sl">
                    <field name="OP">NEG</field>
                    <value name="NUM">
                      <block type="variables_get" id="get_sl_var">
                        <field name="VAR" id="sl_var">stop_loss</field>
                      </block>
                    </value>
                  </block>
                </value>
              </block>
            </value>
            <statement name="DO1">
              <block type="text_print" id="sl_reached_msg">
                <value name="TEXT">
                  <shadow type="text" id="sl_msg_text">
                    <field name="TEXT">Stop Loss Reached!</field>
                  </shadow>
                </value>
              </block>
            </statement>
            <statement name="ELSE">
              <block type="trade_again" id="trade_again_block"></block>
            </statement>
          </block>
        </next>
      </block>
    </statement>
  </block>
</xml>
  `.trim();
}
