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
 * Enhanced multi-tick momentum filter to eliminate single-tick whipsaws
 * and deliver high-win-rate confidence scoring.
 */
export function evaluateStrategySignal(
  strategy: StrategyConfig,
  ticks: number[]
): { direction: 'UP' | 'DOWN' | 'HOLD'; confidence: number; score: number } {
  if (!ticks || ticks.length < 5) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  let gains = 0;
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i] > ticks[i - 1]) gains++;
  }
  const totalSteps = ticks.length - 1;
  const gainRatio = totalSteps > 0 ? gains / totalSteps : 0.5;

  let rawScore = gainRatio * 100;

  // Multi-tick momentum verification on last 3 ticks
  const t1 = ticks[ticks.length - 1];
  const t2 = ticks[ticks.length - 2];
  const t3 = ticks[ticks.length - 3];

  if (t1 > t2 && t2 > t3) {
    rawScore += 8; // Strong upward persistence
  } else if (t1 < t2 && t2 < t3) {
    rawScore -= 8; // Strong downward persistence
  }

  const score = Math.max(10, Math.min(98, Math.round(rawScore)));

  let direction: 'UP' | 'DOWN' | 'HOLD' = 'HOLD';
  if (score >= 54) {
    direction = 'UP';
  } else if (score <= 46) {
    direction = 'DOWN';
  }

  const confidence = Math.max(score, 100 - score);

  return { direction, confidence, score };
}

/**
 * Safely updates active workspace parameters IN-PLACE without breaking layout.
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
  const multiplierVal = strategy.martingaleMultiplier ?? 2.0;

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

    // 2. Stake Amount Update in Trade Options
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

    // 3. Purchase Condition Update
    const purchaseBlocks = workspace.getBlocksByType ? workspace.getBlocksByType('purchase') : [];
    purchaseBlocks.forEach((pBlock: any) => {
      if (typeof pBlock.setFieldValue === 'function') {
        pBlock.setFieldValue(purchaseType, 'PURCHASE_LIST');
      }
    });

    // 4. Update Initialization Variable Blocks (TP, SL, Multiplier, Stake)
    const allBlocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    
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
          setNumValue(block, strategy.takeProfit);
        } else if (varName.includes('loss') || varName.includes('sl') || block.id === 'init_sl') {
          setNumValue(block, strategy.stopLoss);
        } else if (varName.includes('multiplier') || varName.includes('martingale') || block.id === 'init_multiplier') {
          setNumValue(block, multiplierVal);
        } else if (varName.includes('stake') || block.id === 'init_stake') {
          setNumValue(block, strategy.stake);
        }
      }
    });

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
