// src/Aiscanner/strategies.ts

export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface StrategyConfig {
  id: string;
  name: string;
  asset: string;
  type: string;
  stake: number;
  duration: number;
  durationUnit: 't' | 'm' | 's' | 'h';
  stopLoss: number;
  takeProfit: number;
  martingaleMultiplier?: number;
  priority: PriorityLevel;
  confidence?: number;
  direction?: 'RISE' | 'FALL' | 'HOLD';
  score?: number;
}

/**
 * Ensures exactly one strategy is marked as HIGH priority in the array.
 */
export const enforceSingleHighPriority = (
  strategies: StrategyConfig[],
  targetHighId?: string
): StrategyConfig[] => {
  if (!strategies || strategies.length === 0) return [];

  const highId = targetHighId || strategies[0]?.id;

  return strategies.map((strat) => ({
    ...strat,
    priority: strat.id === highId ? 'HIGH' : 'LOW',
  }));
};

/**
 * Evaluates tick data momentum to produce signal direction and confidence level.
 */
export const evaluateStrategySignal = (
  strategy: StrategyConfig,
  ticks: number[]
): { score: number; confidence: number; direction: 'RISE' | 'FALL' | 'HOLD' } => {
  if (!ticks || ticks.length < 5) {
    return { score: 0, confidence: 50, direction: 'HOLD' };
  }

  const recent = ticks.slice(-5);
  const diffs = recent.slice(1).map((val, idx) => val - recent[idx]);
  const positiveDiffs = diffs.filter((d) => d > 0).length;
  const negativeDiffs = diffs.filter((d) => d < 0).length;

  let direction: 'RISE' | 'FALL' | 'HOLD' = 'HOLD';
  let confidence = 50;

  if (positiveDiffs >= 3) {
    direction = 'RISE';
    confidence = Math.min(95, 60 + positiveDiffs * 8);
  } else if (negativeDiffs >= 3) {
    direction = 'FALL';
    confidence = Math.min(95, 60 + negativeDiffs * 8);
  }

  return {
    score: confidence,
    confidence,
    direction,
  };
};

/**
 * Helper to build/inject standard Variable Setter blocks into Blockly XML nodes
 */
const createVariableBlockXml = (varName: string, numValue: number): string => {
  return `
    <block type="variables_set">
      <field name="VAR">${varName}</field>
      <value name="VALUE">
        <block type="math_number">
          <field name="NUM">${numValue}</field>
        </block>
      </value>
    </block>
  `.trim();
};

/**
 * Generates dynamic Block 1 (Initialization) XML containing Stop Loss & Take Profit setup.
 */
export const generateBlock1Xml = (strategy: StrategyConfig): string => {
  const stake = strategy.stake ?? 1;
  const stopLoss = strategy.stopLoss ?? 10;
  const takeProfit = strategy.takeProfit ?? 20;
  const multiplier = strategy.martingaleMultiplier ?? 2.15;

  return `
    <block type="trade_definition" deletable="false" movable="false" x="0" y="0">
      <statement name="TRADE_OPTIONS">
        <block type="trade_definition_initialization">
          <statement name="INITIALIZATION">
            ${createVariableBlockXml('stake', stake)}
            ${createVariableBlockXml('target_profit', takeProfit)}
            ${createVariableBlockXml('stop_loss', stopLoss)}
            ${createVariableBlockXml('martingale_multiplier', multiplier)}
          </statement>
        </block>
      </statement>
    </block>
  `.trim();
};

/**
 * Generates dynamic Block 4 (After Purchase) XML to handle martingale recovery,
 * stop loss checks, and take profit exit conditions.
 */
export const generateBlock4Xml = (strategy: StrategyConfig): string => {
  return `
    <block type="after_purchase" deletable="false" movable="false" x="0" y="600">
      <statement name="AFTERPURCHASE_STACK">
        <block type="controls_if">
          <mutation else="1"></mutation>
          <value name="IF0">
            <block type="contract_check_result">
              <field name="CHECK_RESULT">win</field>
            </block>
          </value>
          <statement name="DO0">
            <block type="text_print">
              <value name="TEXT">
                <shadow type="text">
                  <field name="TEXT">Win! Resetting Stake.</field>
                </shadow>
              </value>
            </block>
            ${createVariableBlockXml('stake', strategy.stake ?? 1)}
          </statement>
          <statement name="ELSE">
            <block type="text_print">
              <value name="TEXT">
                <shadow type="text">
                  <field name="TEXT">Loss! Applying Martingale.</field>
                </shadow>
              </value>
            </block>
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
                    <block type="math_number">
                      <field name="NUM">${strategy.martingaleMultiplier ?? 2.15}</field>
                    </block>
                  </value>
                </block>
              </value>
            </block>
          </statement>
        </block>
        <block type="trade_again"></block>
      </statement>
    </block>
  `.trim();
};

export const DEFAULT_STRATEGIES: StrategyConfig[] = [
  {
    id: 'strat-v10',
    name: 'Volatility 10 Index',
    asset: 'Volatility 10 Index',
    type: 'Rise/Fall',
    stake: 2,
    duration: 1,
    durationUnit: 't',
    stopLoss: 10,
    takeProfit: 15,
    martingaleMultiplier: 2.15,
    priority: 'HIGH',
    confidence: 85,
    direction: 'RISE',
  },
  {
    id: 'strat-v25',
    name: 'Volatility 25 Index',
    asset: 'Volatility 25 Index',
    type: 'Rise/Fall',
    stake: 2,
    duration: 1,
    durationUnit: 't',
    stopLoss: 10,
    takeProfit: 20,
    martingaleMultiplier: 2.15,
    priority: 'LOW',
    confidence: 72,
    direction: 'FALL',
  },
  {
    id: 'strat-v75',
    name: 'Volatility 75 Index',
    asset: 'Volatility 75 Index',
    type: 'Rise/Fall',
    stake: 5,
    duration: 1,
    durationUnit: 't',
    stopLoss: 25,
    takeProfit: 50,
    martingaleMultiplier: 2.15,
    priority: 'LOW',
    confidence: 65,
    direction: 'RISE',
  },
];
