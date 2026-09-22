// src/Aiscanner/strategies.ts

export interface TickData {
  quote: number;
  epoch: number;
}

export interface StrategyParameters {
  stake: number;
  stopLoss: number;
  takeProfit: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  symbol: string;
  type: string;
  variant: string;
  badgeLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  parameters: StrategyParameters;
  evaluate: (ticks: TickData[]) => { 
    confidence: number; 
    score: number; 
    direction: 'RISE' | 'FALL' | 'READY';
  };
}

// 1. AI Adaptive Strategy (Volatility 25)
const aiAdaptive: StrategyDefinition = {
  id: 'ai-adaptive-vol25',
  name: 'AI Adaptive',
  symbol: 'Volatility 25',
  type: 'RISE / FALL',
  variant: 'NEURAL_FLOW',
  badgeLevel: 'HIGH',
  parameters: { stake: 3, stopLoss: 4, takeProfit: 8 },
  evaluate: (ticks) => {
    if (ticks.length < 5) return { confidence: 0.5, score: 50, direction: 'READY' };
    const recent = ticks.slice(-5);
    let rises = 0;
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].quote > recent[i - 1].quote) rises++;
    }
    const confidence = rises >= 4 ? 0.84 : rises <= 1 ? 0.81 : 0.62;
    const direction = rises >= 3 ? 'RISE' : 'FALL';
    return { confidence, score: Math.round(confidence * 100), direction };
  },
};

// 2. 1-3-2-6 System Strategy (Volatility 10)
const system1326: StrategyDefinition = {
  id: '1326-system-vol10',
  name: '1-3-2-6 System',
  symbol: 'Volatility 10',
  type: 'RISE / FALL',
  variant: 'PROGRESSIVE',
  badgeLevel: 'MEDIUM',
  parameters: { stake: 3, stopLoss: 4, takeProfit: 8 },
  evaluate: (ticks) => {
    if (ticks.length < 5) return { confidence: 0.5, score: 50, direction: 'READY' };
    const last = ticks[ticks.length - 1].quote;
    const prev = ticks[ticks.length - 2].quote;
    const confidence = last > prev ? 0.83 : 0.65;
    return { confidence, score: Math.round(confidence * 100), direction: last > prev ? 'RISE' : 'FALL' };
  },
};

// 3. Hyper Scalper Engine v26 (Volatility 10)
const hyperScalper: StrategyDefinition = {
  id: 'hyper-scalper-v26',
  name: 'Hyper Scalper Engine v26',
  symbol: 'Volatility 10',
  type: 'RISE / FALL',
  variant: 'MARTINGALE',
  badgeLevel: 'MEDIUM',
  parameters: { stake: 3, stopLoss: 4, takeProfit: 8 },
  evaluate: (ticks) => {
    if (ticks.length < 5) return { confidence: 0.5, score: 50, direction: 'READY' };
    const count = ticks.length;
    const confidence = count % 2 === 0 ? 0.83 : 0.67;
    return { confidence, score: Math.round(confidence * 100), direction: 'FALL' };
  },
};

// 4. AI Balanced Strategy (Volatility 50)
const aiBalanced: StrategyDefinition = {
  id: 'ai-balanced-vol50',
  name: 'AI Balanced',
  symbol: 'Volatility 50',
  type: 'OVER / UNDER',
  variant: 'PROGRESSIVE',
  badgeLevel: 'LOW',
  parameters: { stake: 3, stopLoss: 4, takeProfit: 8 },
  evaluate: (ticks) => {
    if (ticks.length < 5) return { confidence: 0.5, score: 50, direction: 'READY' };
    return { confidence: 0.64, score: 84, direction: 'RISE' };
  },
};

// 5. AI Trend Printer (Volatility 100)
const aiTrendPrinter: StrategyDefinition = {
  id: 'ai-trend-printer-vol100',
  name: 'AI Trend Printer',
  symbol: 'Volatility 100',
  type: 'RISE / FALL',
  variant: 'NEURAL_FLOW',
  badgeLevel: 'LOW',
  parameters: { stake: 3, stopLoss: 4, takeProfit: 8 },
  evaluate: (ticks) => {
    if (ticks.length < 5) return { confidence: 0.5, score: 50, direction: 'READY' };
    return { confidence: 0.64, score: 40, direction: 'FALL' };
  },
};

// 6. Reverse D'Alembert (Volatility 75)
const reverseDAlembert: StrategyDefinition = {
  id: 'reverse-dalembert-vol75',
  name: 'Reverse D\'Alembert',
  symbol: 'Volatility 75',
  type: 'RISE / FALL',
  variant: 'PROGRESSIVE',
  badgeLevel: 'LOW',
  parameters: { stake: 3, stopLoss: 4, takeProfit: 8 },
  evaluate: (ticks) => {
    if (ticks.length < 5) return { confidence: 0.5, score: 50, direction: 'READY' };
    return { confidence: 0.58, score: 58, direction: 'RISE' };
  },
};

// 7. Micro Momentum Scalper (1HZ100V)
const microMomentum: StrategyDefinition = {
  id: 'micro-momentum-1hz100v',
  name: 'Micro Momentum 1HZ',
  symbol: 'Volatility 100 (1s)',
  type: 'RISE / FALL',
  variant: 'TICK_MOMENTUM',
  badgeLevel: 'HIGH',
  parameters: { stake: 3, stopLoss: 4, takeProfit: 8 },
  evaluate: (ticks) => {
    if (ticks.length < 5) return { confidence: 0.5, score: 50, direction: 'READY' };
    return { confidence: 0.86, score: 86, direction: 'RISE' };
  },
};

export const CORE_7_STRATEGIES: StrategyDefinition[] = [
  aiAdaptive,
  system1326,
  hyperScalper,
  aiBalanced,
  aiTrendPrinter,
  reverseDAlembert,
  microMomentum,
];
