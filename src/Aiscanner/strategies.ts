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
  const variance = window.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / window.length;
  const standardDeviation = Math.sqrt(variance);
  const currentPrice = window[window.length - 1];
  const zScore = standardDeviation > 0 ? (currentPrice - mean) / standardDeviation : 0;

  const baseScore = totalWeightAccumulator > 0 ? weightedMomentumSum / totalWeightAccumulator : 50;
  let scoreAdjustment = (netDisplacement > 0 ? efficiencyRatio : -efficiencyRatio) * 22;
  let computedScore = Math.round(baseScore + scoreAdjustment);

  const score = Math.max(2, Math.min(98, computedScore));

  // Fluid execution gates to keep the bot active and prevent HOLD-stalling
  let direction: 'UP' | 'DOWN' | 'HOLD' = 'HOLD';
  if (score >= 62 && efficiencyRatio >= 0.32 && zScore > 0.15) {
    direction = 'UP';
  } else if (score <= 38 && efficiencyRatio >= 0.32 && zScore < -0.15) {
    direction = 'DOWN';
  }

  // Dynamic confidence scaling that safely peaks at 98% during clean structural breakouts
  const structuralConviction = Math.max(score, 100 - score);
  const confidenceMultiplier = efficiencyRatio >= 0.48 ? 1.38 : 1.10;
  const confidence = structuralConviction >= 60
    ? Math.min(98, Math.round(structuralConviction * confidenceMultiplier))
    : structuralConviction;

  return { direction, confidence, score };
}

/**
 * Leaves existing canvas dropdowns untouched and builds ONLY the 
 * "Run once at start" initialization stack (Target Profit, Stop Loss, Martingale Size).
 */
export function applyStrategyToWorkspace(workspace: any, strategy: StrategyConfig): boolean {
  if (!workspace) return false;

  const multiplierVal = strategy.martingaleMultiplier ?? 2.0;

  try {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    const rootTradeBlock =
      workspace.getBlockById('trade_definition') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition')[0]);

    if (rootTradeBlock) {
      const initInput = rootTradeBlock.getInput('INITIALIZATION');
      if (initInput) {
        let existingChild = initInput.connection.targetBlock();
        while (existingChild) {
          const nextChild = existingChild.nextConnection && existingChild.nextConnection.targetBlock();
          if (typeof existingChild.dispose === 'function') {
            existingChild.dispose(true);
          }
          existingChild = nextChild;
        }

        const getOrCreateVar = (name: string) => {
          let variable = workspace.getVariableMap ? workspace.getVariableMap().getVariable(name) : null;
          if (!variable && typeof workspace.createVariable === 'function') {
            variable = workspace.createVariable(name);
          }
          return variable;
        };

        const vTp = getOrCreateVar('target_profit');
        const vSl = getOrCreateVar('stop_loss');
        const vMult = getOrCreateVar('martingale_size');

        const buildVarSetXml = (varObj: any, varName: string, val: number) => {
          const varId = varObj ? (varObj.getId ? varObj.getId() : varObj.id_) : varName;
          return `
            <block type="variables_set">
              <field name="VAR" id="${varId}" variabletype="">${varName}</field>
              <value name="VALUE">
                <block type="math_number">
                  <field name="NUM">${val}</field>
                </block>
              </value>
            </block>
          `.trim();
        };

        const parser = new DOMParser();
        const createBlockFromXml = (xmlStr: string) => {
          const doc = parser.parseFromString(xmlStr, 'text/xml');
          if (window.Blockly && window.Blockly.Xml && typeof window.Blockly.Xml.domToBlock === 'function') {
            return window.Blockly.Xml.domToBlock(doc.documentElement, workspace);
          }
          return null;
        };

        const tpBlock = createBlockFromXml(buildVarSetXml(vTp, 'target_profit', strategy.takeProfit));
        const slBlock = createBlockFromXml(buildVarSetXml(vSl, 'stop_loss', strategy.stopLoss));
        const multBlock = createBlockFromXml(buildVarSetXml(vMult, 'martingale_size', multiplierVal));

        const blocks = [tpBlock, slBlock, multBlock].filter(Boolean);

        let currentConnection = initInput.connection;
        for (const block of blocks) {
          if (block && currentConnection) {
            if (typeof block.initSvg === 'function') block.initSvg();
            if (block.previousConnection) {
              currentConnection.connect(block.previousConnection);
              currentConnection = block.nextConnection;
            }
          }
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
    console.error('[Strategies] Failed to build run-once variables:', error);
    return false;
  }
}
