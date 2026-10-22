// ==========================================
// FILE: src/Aiscanner/strategies.ts
// ==========================================
export interface Strategy {
    id: string;
    name: string;
    market: string;          // Must match the WebSocket symbol key for proper mapping
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
    { id: '1', name: 'RSI Momentum Spike', market: '1HZ10V', symbol: '1HZ10V', volatility: '10s', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '2', name: 'Bollinger Band Squeeze', market: 'R_25', symbol: 'R_25', volatility: '25', confidence: 50, direction: 'DOWN', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '3', name: 'EMA Crossover Breakout', market: '1HZ50V', symbol: '1HZ50V', volatility: '50s', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '4', name: 'Tick Reversal Pattern', market: 'R_75', symbol: 'R_75', volatility: '75', confidence: 50, direction: 'DOWN', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '5', name: 'MACD Histogram Surge', market: '1HZ100V', symbol: '1HZ100V', volatility: '100s', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '6', name: 'Support/Resistance Bounce', market: 'R_10', symbol: 'R_10', volatility: '10', confidence: 50, direction: 'UP', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, status: 'high' },
    { id: '7', name: 'High-Frequency Digit Scalper', market: '1HZ75V', symbol: '1HZ75V', volatility: '75s', confidence: 50, direction: 'DIGITOVER', recommendedStake: 0.35, recommendedStopLoss: 4.50, recommendedTakeProfit: 3.00, contractType: 'DIGITOVER', barrier: '2', status: 'high' },
];

export const CORE_7_STRATEGIES = INITIAL_STRATEGIES;
