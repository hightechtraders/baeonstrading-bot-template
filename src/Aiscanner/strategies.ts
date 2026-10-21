// ==========================================
// FILE: src/Aiscanner/strategies.ts
// ==========================================
export interface Strategy {
    id: string;
    name: string;
    market: string;          // Human-readable display name
    symbol: string;          // True Deriv API WebSocket symbol key
    volatility: string;
    confidence: number;
    direction: 'UP' | 'DOWN' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITEVEN' | 'DIGITODD';
    recommendedStake: number;
    recommendedStopLoss: number;
    recommendedTakeProfit: number;
    contractType?: string;   
    barrier?: string;        
    status?: string;         
}

export const INITIAL_STRATEGIES: Strategy[] = [
    { id: '1', name: 'RSI Momentum Spike', market: 'Volatility 10 (1s) Index', symbol: '1HZ10V', volatility: '10s', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '2', name: 'Bollinger Band Squeeze', market: 'Volatility 25 Index', symbol: 'R_25', volatility: '25', confidence: 50, direction: 'DOWN', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '3', name: 'EMA Crossover Breakout', market: 'Volatility 50 (1s) Index', symbol: '1HZ50V', volatility: '50s', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '4', name: 'Tick Reversal Pattern', market: 'Volatility 75 Index', symbol: 'R_75', volatility: '75', confidence: 50, direction: 'DOWN', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '5', name: 'MACD Histogram Surge', market: 'Volatility 100 (1s) Index', symbol: '1HZ100V', volatility: '100s', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '6', name: 'Support/Resistance Bounce', market: 'Volatility 10 Index', symbol: 'R_10', volatility: '10', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '7', name: 'High-Frequency Digit Scalper', market: 'Volatility 75 (1s) Index', symbol: '1HZ75V', volatility: '75s', confidence: 50, direction: 'DIGITOVER', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, contractType: 'DIGITOVER', barrier: '2', status: 'high' },
];

export const CORE_7_STRATEGIES = INITIAL_STRATEGIES;
