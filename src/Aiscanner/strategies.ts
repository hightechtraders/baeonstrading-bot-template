// strategies.ts

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
}

export interface StrategySignal {
  strategyId: string;
  direction: 'UP' | 'DOWN' | 'HOLD';
  confidence: number;
  score: number;
  timestamp: number;
}

/**
 * Ensures strictly ONLY ONE strategy in the array is set to 'HIGH' priority.
 * Automatically promotes the top candidate (or target ID) and lowers the rest.
 */
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
 * Calculates Neural Flow / Tick Momentum signals from tick history
 */
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
 * Generates valid Deriv DBot Blockly XML representation for workspace importing.
 */
export function generateDBotXml(strategy: StrategyConfig): string {
  const formattedMarket = strategy.asset.toLowerCase().replace(/[^a-z0-9]/g, '');

  return `
<xml xmlns="https://developers.google.com/blockly/xml">
  <block type="trade_definition" id="trade_def_root" x="0" y="0">
    <statement name="TRADE_OPTIONS">
      <block type="trade_definition_market" id="market_block">
        <field name="MARKET_LIST">${formattedMarket}</field>
      </block>
    </statement>
  </block>
  <block type="trade_definition_tradeoptions" id="trade_opts_block" x="0" y="220">
    <field name="AMOUNT">${strategy.stake}</field>
    <field name="STOP_LOSS">${strategy.stopLoss}</field>
    <field name="TAKE_PROFIT">${strategy.takeProfit}</field>
  </block>
</xml>
  `.trim();
}
