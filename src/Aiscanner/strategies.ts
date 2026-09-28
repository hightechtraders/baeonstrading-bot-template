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
    stopLoss: 10,
    takeProfit: 20,
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
    stopLoss: 10,
    takeProfit: 15,
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
    stopLoss: 15,
    takeProfit: 25,
    martingaleMultiplier: 2.1,
    description: 'Martingale scalp strategy designed for Volatility 10.',
  },
  {
    id: 'strat-4',
    name: '#4 AI Balanced',
    asset: 'Volatility 50',
    tradeType: 'Rise / Fall',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 5,
    stopLoss: 15,
    takeProfit: 30,
    martingaleMultiplier: 2.0,
    description: 'Balanced trend strategy designed for Volatility 50.',
  },
  {
    id: 'strat-5',
    name: '#5 Momentum Breakout',
    asset: 'Volatility 75',
    tradeType: 'Rise / Fall',
    riskModel: 'TICK_MOMENTUM',
    priority: 'MEDIUM',
    stake: 2,
    stopLoss: 12,
    takeProfit: 24,
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
    stopLoss: 15,
    takeProfit: 30,
    martingaleMultiplier: 2.0,
    description: 'Fast-cycle neural model designed for Volatility 100 (1s).',
  },
  {
    id: 'strat-7',
    name: '#7 Conservative Grid',
    asset: 'Volatility 100',
    tradeType: 'Rise / Fall',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 1,
    stopLoss: 8,
    takeProfit: 16,
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
 * Robust Signal Engine with Trend Filtering
 */
export function evaluateStrategySignal(
  strategy: StrategyConfig,
  ticks: number[]
): { direction: 'UP' | 'DOWN' | 'HOLD'; confidence: number; score: number } {
  if (!ticks || ticks.length < 15) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  const window = ticks.slice(-20);
  let netDisplacement = 0;
  let totalAbsoluteVolatility = 0;
  let upTicks = 0;

  for (let i = 1; i < window.length; i++) {
    const delta = window[i] - window[i - 1];
    netDisplacement += delta;
    totalAbsoluteVolatility += Math.abs(delta);
    if (delta > 0) upTicks++;
  }

  if (totalAbsoluteVolatility === 0) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  const efficiencyRatio = Math.abs(netDisplacement) / totalAbsoluteVolatility;
  const rawScore = Math.round((upTicks / (window.length - 1)) * 100);
  const score = Math.max(5, Math.min(95, rawScore));

  let direction: 'UP' | 'DOWN' | 'HOLD' = 'HOLD';
  // Require strong directional bias and efficiency to prevent false whipsaws
  if (score >= 60 && efficiencyRatio >= 0.25) {
    direction = 'UP';
  } else if (score <= 40 && efficiencyRatio >= 0.25) {
    direction = 'DOWN';
  }

  const confidence = Math.round(50 + Math.abs(score - 50) * 0.9 + efficiencyRatio * 15);

  return { direction, confidence: Math.min(95, confidence), score };
}

/**
 * Maps asset names to DBot symbol internal keys.
 */
export function getAssetSymbol(assetName: string): string {
  const normalized = assetName.toLowerCase();
  if (normalized.includes('100 (1s)')) return '1HZ100V';
  if (normalized.includes('50 (1s)')) return '1HZ50V';
  if (normalized.includes('25 (1s)')) return '1HZ25V';
  if (normalized.includes('10 (1s)')) return '1HZ10V';
  if (normalized.includes('100')) return 'R_100';
  if (normalized.includes('75')) return 'R_75';
  if (normalized.includes('50')) return 'R_50';
  if (normalized.includes('25')) return 'R_25';
  if (normalized.includes('10')) return 'R_10';
  return 'R_100';
}

/**
 * Safely mutates existing blocks on the active DBot Blockly workspace in-place
 * without wiping event hooks or crashing the runner.
 */
export function applyStrategyToWorkspace(workspace: any, strategy: StrategyConfig): boolean {
  if (!workspace || typeof workspace.getAllBlocks !== 'function') {
    console.error('[Strategies] Blockly workspace is invalid or uninitialized.');
    return false;
  }

  try {
    const blocks = workspace.getAllBlocks(false);
    const symbolCode = getAssetSymbol(strategy.asset);
    const targetDirection = strategy.direction === 'DOWN' ? 'DOWN' : 'UP';

    let updatedAny = false;

    blocks.forEach((block: any) => {
      // 1. Update Trade Definition (Symbol & Market)
      if (block.type === 'trade_definition') {
        if (typeof block.setFieldValue === 'function') {
          block.setFieldValue(symbolCode, 'SYMBOL_LIST');
          updatedAny = true;
        }
      }

      // 2. Update Trade Options (Stake Amount)
      if (block.type === 'trade_options') {
        const amountInput = block.getInput('AMOUNT');
        if (amountInput && amountInput.connection && amountInput.connection.targetBlock()) {
          const numBlock = amountInput.connection.targetBlock();
          if (numBlock.type === 'math_number' && typeof numBlock.setFieldValue === 'function') {
            numBlock.setFieldValue(String(strategy.stake), 'NUM');
            updatedAny = true;
          }
        }
      }

      // 3. Update Purchase Direction Block
      if (block.type === 'purchase') {
        if (typeof block.setFieldValue === 'function') {
          block.setFieldValue(targetDirection, 'PURCHASE_LIST');
          updatedAny = true;
        }
      }
    });

    if (updatedAny && typeof workspace.render === 'function') {
      workspace.render();
      return true;
    }

    console.warn('[Strategies] No matching DBot blocks found to update. Ensure a standard bot template is loaded.');
    return false;
  } catch (error) {
    console.error('[Strategies] In-place workspace update failed:', error);
    return false;
  }
}
