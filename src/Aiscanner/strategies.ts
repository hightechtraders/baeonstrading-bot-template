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

export const CORE_7_STRATEGIES: StrategyConfig[] = [
  { id: 'strat-1', name: '#1 AI Adaptive', asset: 'Volatility 25', tradeType: 'Rise / Fall', riskModel: 'NEURAL_FLOW', priority: 'HIGH', stake: 3, stopLoss: 4, takeProfit: 8, description: 'Neural Flow model for Volatility 25.' },
  { id: 'strat-2', name: '#2 1-3-2-6 System', asset: 'Volatility 10', tradeType: 'Rise / Fall', riskModel: 'PROGRESSIVE', priority: 'MEDIUM', stake: 2, stopLoss: 5, takeProfit: 10, description: 'Progressive staking system for Volatility 10.' },
  { id: 'strat-3', name: '#3 Hyper Scalper', asset: 'Volatility 10', tradeType: 'Rise / Fall', riskModel: 'MARTINGALE', priority: 'MEDIUM', stake: 1, stopLoss: 10, takeProfit: 15, description: 'Martingale scalp for Volatility 10.' },
  { id: 'strat-4', name: '#4 AI Balanced', asset: 'Volatility 50', tradeType: 'Over / Under', riskModel: 'PROGRESSIVE', priority: 'MEDIUM', stake: 5, stopLoss: 10, takeProfit: 20, description: 'Digit strategy for Volatility 50.' },
  { id: 'strat-5', name: '#5 Momentum Breakout', asset: 'Volatility 75', tradeType: 'Rise / Fall', riskModel: 'TICK_MOMENTUM', priority: 'MEDIUM', stake: 2, stopLoss: 6, takeProfit: 12, description: 'Breakout tick strategy for Volatility 75.' },
  { id: 'strat-6', name: '#6 High-Frequency Scalp', asset: 'Volatility 100 (1s)', tradeType: 'Rise / Fall', riskModel: 'NEURAL_FLOW', priority: 'MEDIUM', stake: 4, stopLoss: 8, takeProfit: 16, description: 'Fast neural model for Volatility 100 (1s).' },
  { id: 'strat-7', name: '#7 Conservative Grid', asset: 'Volatility 100', tradeType: 'Over / Under', riskModel: 'PROGRESSIVE', priority: 'MEDIUM', stake: 1, stopLoss: 3, takeProfit: 6, description: 'Low-risk grid for Volatility 100.' },
];

export function evaluateStrategySignal(strategy: StrategyConfig, ticks: number[]) {
  if (!ticks || ticks.length < 3) return { direction: 'HOLD' as const, confidence: 50, score: 50 };
  
  const latest = ticks[ticks.length - 1];
  const prev = ticks[ticks.length - 2];
  const diff = latest - prev;
  
  let gains = 0;
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i] > ticks[i - 1]) gains++;
  }
  const score = Math.max(15, Math.min(95, Math.round((gains / (ticks.length - 1)) * 100)));
  const direction = score >= 52 || diff > 0 ? 'UP' : score <= 48 || diff < 0 ? 'DOWN' : 'HOLD';
  const confidence = Math.max(score, 100 - score);

  return { direction, confidence, score };
}

export function applyStrategyToWorkspace(workspace: any, strategy: StrategyConfig): boolean {
  if (!workspace) return false;

  const symbolMap: Record<string, string> = {
    'Volatility 10': 'R_10',
    'Volatility 25': 'R_25',
    'Volatility 50': 'R_50',
    'Volatility 75': 'R_75',
    'Volatility 100': 'R_100',
    'Volatility 100 (1s)': '1HZ100V',
  };

  const symbol = symbolMap[strategy.asset] || '1HZ100V';
  const purchaseType = strategy.direction === 'DOWN' ? 'FALL' : 'RISE';

  try {
    if (typeof workspace.setEnableEvents === 'function') workspace.setEnableEvents(false);

    // 1. Update Market / Symbol
    const marketBlock = workspace.getBlockById('trade_definition_market') || workspace.getBlocksByType?.('trade_definition_market')?.[0];
    if (marketBlock) marketBlock.setFieldValue(symbol, 'SYMBOL_LIST');

    // 2. Update Stake Amount
    const tradeOptions = workspace.getBlockById('trade_definition_tradeoptions') || workspace.getBlocksByType?.('trade_definition_tradeoptions')?.[0];
    if (tradeOptions) {
      const amountInput = tradeOptions.getInput('AMOUNT');
      const shadowBlock = amountInput?.connection?.targetBlock();
      if (shadowBlock) shadowBlock.setFieldValue(String(strategy.stake), 'NUM');
    }

    // 3. Update Purchase Direction (Rise/Fall)
    const purchaseBlocks = workspace.getBlocksByType?.('purchase') || [];
    purchaseBlocks.forEach((p: any) => p.setFieldValue(purchaseType, 'PURCHASE_LIST'));

    if (typeof workspace.setEnableEvents === 'function') workspace.setEnableEvents(true);
    if (typeof workspace.render === 'function') workspace.render();
    return true;
  } catch (err) {
    if (typeof workspace.setEnableEvents === 'function') workspace.setEnableEvents(true);
    console.error('Workspace injection error:', err);
    return false;
  }
}
