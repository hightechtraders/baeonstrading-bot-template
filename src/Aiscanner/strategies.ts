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
    score?: number;          // Added to safely map calculation scores
}

export const INITIAL_STRATEGIES: Strategy[] = [
    { 
        id: 'R10_BULLISH_ALPHA', 
        name: 'R-10 Bullish Alpha', 
        market: 'R_10', 
        symbol: 'R_10', 
        volatility: '10', 
        confidence: 50, 
        score: 50,
        direction: 'UP', 
        recommendedStake: 0.35, 
        recommendedStopLoss: 4.50, 
        recommendedTakeProfit: 3.00, 
        contractType: 'CALL',
        status: 'high' 
    },
    { 
        id: 'R10_BEARISH_ALPHA', 
        name: 'R-10 Bearish Alpha', 
        market: 'R_10', 
        symbol: 'R_10', 
        volatility: '10', 
        confidence: 50, 
        score: 50,
        direction: 'DOWN', 
        recommendedStake: 0.35, 
        recommendedStopLoss: 4.50, 
        recommendedTakeProfit: 3.00, 
        contractType: 'PUT',
        status: 'high' 
    },
];

export const CORE_7_STRATEGIES = INITIAL_STRATEGIES;
