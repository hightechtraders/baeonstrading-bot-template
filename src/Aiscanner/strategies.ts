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
  martingaleMultiplier: number;
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
    martingaleMultiplier: 2.0,
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
    martingaleMultiplier: 2.0,
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
    martingaleMultiplier: 2.1,
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
    martingaleMultiplier: 2.0,
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
    martingaleMultiplier: 2.0,
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
    martingaleMultiplier: 2.0,
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
    martingaleMultiplier: 1.5,
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
 * High-Precision Win-Rate Optimized Signal Engine
 */
export function evaluateStrategySignal(
  strategy: StrategyConfig,
  ticks: number[]
): { direction: 'UP' | 'DOWN' | 'HOLD'; confidence: number; score: number } {
  if (!ticks || ticks.length < 10) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  const window = ticks.slice(-12);
  let netDisplacement = 0;
  let totalAbsoluteVolatility = 0;
  let weightedMomentumSum = 0;
  let totalWeightAccumulator = 0;

  for (let i = 1; i < window.length; i++) {
    const delta = window[i] - window[i - 1];
    netDisplacement += delta;
    totalAbsoluteVolatility += Math.abs(delta);
    const recencyWeight = i >= window.length - 4 ? 3.0 : 1.0;
    totalWeightAccumulator += recencyWeight;

    if (delta > 0) {
      weightedMomentumSum += 100 * recencyWeight;
    } else if (delta < 0) {
      weightedMomentumSum += 0 * recencyWeight;
    } else {
      weightedMomentumSum += 50 * recencyWeight;
    }
  }

  if (totalAbsoluteVolatility === 0) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  const efficiencyRatio = Math.abs(netDisplacement) / totalAbsoluteVolatility;
  const mean = window.reduce((acc, val) => acc + val, 0) / window.length;
  const variance =
    window.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    window.length;
  const standardDeviation = Math.sqrt(variance);
  const currentPrice = window[window.length - 1];
  const zScore =
    standardDeviation > 0 ? (currentPrice - mean) / standardDeviation : 0;

  const baseScore =
    totalWeightAccumulator > 0
      ? weightedMomentumSum / totalWeightAccumulator
      : 50;
  let scoreAdjustment =
    (netDisplacement > 0 ? efficiencyRatio : -efficiencyRatio) * 22;
  let computedScore = Math.round(baseScore + scoreAdjustment);
  const score = Math.max(2, Math.min(98, computedScore));

  let direction: 'UP' | 'DOWN' | 'HOLD' = 'HOLD';
  if (score >= 62 && efficiencyRatio >= 0.32 && zScore > 0.15) {
    direction = 'UP';
  } else if (score <= 38 && efficiencyRatio >= 0.32 && zScore < -0.15) {
    direction = 'DOWN';
  }

  const structuralConviction = Math.max(score, 100 - score);
  const confidenceMultiplier = efficiencyRatio >= 0.48 ? 1.38 : 1.10;
  const confidence =
    structuralConviction >= 60
      ? Math.min(98, Math.round(structuralConviction * confidenceMultiplier))
      : structuralConviction;

  return { direction, confidence, score };
}

/**
 * Maps human-readable asset names from StrategyConfig to DBot internal workspace keys.
 */
function getAssetMapping(assetName: string): {
  marketType: string;
  submarket: string;
  symbol: string;
} {
  const normalized = assetName.toLowerCase();

  if (normalized.includes('volatility 10 (1s)')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: '1HZ10V' };
  }
  if (normalized.includes('volatility 10')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: 'R_10' };
  }
  if (normalized.includes('volatility 25 (1s)')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: '1HZ25V' };
  }
  if (normalized.includes('volatility 25')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: 'R_25' };
  }
  if (normalized.includes('volatility 50 (1s)')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: '1HZ50V' };
  }
  if (normalized.includes('volatility 50')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: 'R_50' };
  }
  if (normalized.includes('volatility 75 (1s)')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: '1HZ75V' };
  }
  if (normalized.includes('volatility 75')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: 'R_75' };
  }
  if (normalized.includes('volatility 100 (1s)')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: '1HZ100V' };
  }
  if (normalized.includes('volatility 100')) {
    return { marketType: 'synthetic_index', submarket: 'random_index', symbol: 'R_100' };
  }

  return { marketType: 'synthetic_index', submarket: 'random_index', symbol: 'R_100' };
}

/**
 * Generates a complete, self-contained XML string for the workspace blueprint.
 */
function buildCompleteBotXml(
  strategy: StrategyConfig,
  assetMapped: { marketType: string; submarket: string; symbol: string }
): string {
  // DBot expects 'UP' or 'DOWN' for Rise/Fall purchase conditions
  const targetDirection = strategy.direction === 'DOWN' ? 'DOWN' : 'UP';
  const tradeTypeCat = strategy.tradeType.toLowerCase().includes('over') ? 'digits' : 'updown';
  const tradeType = strategy.tradeType.toLowerCase().includes('over') ? 'overunder' : 'risefall';

  return `
    <xml xmlns="http://www.w3.org/1999/xhtml">
      <block type="trade_definition" id="trade_definition_block" x="0" y="0">
        <field name="MARKET_LIST">${assetMapped.marketType}</field>
        <field name="SUBMARKET_LIST">${assetMapped.submarket}</field>
        <field name="SYMBOL_LIST">${assetMapped.symbol}</field>
        <field name="TRADETYPECAT_LIST">${tradeTypeCat}</field>
        <field name="TRADETYPE_LIST">${tradeType}</field>
        <field name="TYPECAT_LIST">both</field>
        <field name="CANDLEINTERVAL_LIST">60</field>
        <field name="TIME_MACHINE_ENABLED">FALSE</field>
        <field name="RESTARTONERROR">FALSE</field>
        <field name="REPEATONERROR">TRUE</field>

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
 * Applies strategy parameters to the workspace cleanly via atomic XML injection.
 * Clears the workspace and loads a fully validated blueprint to prevent broken Blockly states.
 */
export function applyStrategyToWorkspace(workspace: any, strategy: StrategyConfig): boolean {
  if (!workspace) return false;

  const assetMapped = getAssetMapping(strategy.asset);

  try {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    if (typeof workspace.clear === 'function') {
      workspace.clear();
    }

    const xmlString = buildCompleteBotXml(strategy, assetMapped);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (window.Blockly && window.Blockly.Xml && typeof window.Blockly.Xml.domToWorkspace === 'function') {
      window.Blockly.Xml.domToWorkspace(doc.documentElement, workspace);
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
    console.error('[Strategies] Workspace XML injection failed:', error);
    return false;
  }
}
