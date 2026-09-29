export interface Strategy {
  id: string;
  name: string;
  market: string;
  volatility: string;
  confidence: number;
  recommendedStake: number;
  recommendedStopLoss: number;
  recommendedTakeProfit: number;
}

export const INITIAL_STRATEGIES: Strategy[] = [
  { id: '1', name: 'RSI Momentum Spike', market: 'Volatility 10 (1s) Index', volatility: '10s', confidence: 92, recommendedStake: 10, recommendedStopLoss: 20, recommendedTakeProfit: 50 },
  { id: '2', name: 'Bollinger Band Squeeze', market: 'Volatility 25 Index', volatility: '25', confidence: 88, recommendedStake: 10, recommendedStopLoss: 15, recommendedTakeProfit: 40 },
  { id: '3', name: 'EMA Crossover Breakout', market: 'Volatility 50 (1s) Index', volatility: '50s', confidence: 95, recommendedStake: 20, recommendedStopLoss: 30, recommendedTakeProfit: 80 },
  { id: '4', name: 'Tick Reversal Pattern', market: 'Volatility 75 Index', volatility: '75', confidence: 84, recommendedStake: 10, recommendedStopLoss: 25, recommendedTakeProfit: 60 },
  { id: '5', name: 'MACD Histogram Surge', market: 'Volatility 100 (1s) Index', volatility: '100s', confidence: 91, recommendedStake: 15, recommendedStopLoss: 20, recommendedTakeProfit: 55 },
  { id: '6', name: 'Support/Resistance Bounce', market: 'Volatility 10 Index', volatility: '10', confidence: 79, recommendedStake: 10, recommendedStopLoss: 15, recommendedTakeProfit: 30 },
  { id: '7', name: 'High-Frequency Scalper', market: 'Volatility 75 (1s) Index', volatility: '75s', confidence: 94, recommendedStake: 25, recommendedStopLoss: 40, recommendedTakeProfit: 100 },
];

// Alias required by App.tsx imports
export const CORE_7_STRATEGIES = INITIAL_STRATEGIES;
