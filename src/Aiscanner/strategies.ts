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
    // Volatility 10 Index
    {
        id: 'R10_BULLISH_ALPHA',
        name: 'V10 Bullish Alpha',
        market: 'R_10',
        symbol: 'R_10',
        volatility: '10',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: 'R10_BEARISH_ALPHA',
        name: 'V10 Bearish Alpha',
        market: 'R_10',
        symbol: 'R_10',
        volatility: '10',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 10 (1s) Index
    {
        id: '1HZ10V_BULLISH_ALPHA',
        name: 'V10 (1s) Bullish Alpha',
        market: '1HZ10V',
        symbol: '1HZ10V',
        volatility: '10 (1s)',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: '1HZ10V_BEARISH_ALPHA',
        name: 'V10 (1s) Bearish Alpha',
        market: '1HZ10V',
        symbol: '1HZ10V',
        volatility: '10 (1s)',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 25 Index
    {
        id: 'R25_BULLISH_ALPHA',
        name: 'V25 Bullish Alpha',
        market: 'R_25',
        symbol: 'R_25',
        volatility: '25',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: 'R25_BEARISH_ALPHA',
        name: 'V25 Bearish Alpha',
        market: 'R_25',
        symbol: 'R_25',
        volatility: '25',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 25 (1s) Index
    {
        id: '1HZ25V_BULLISH_ALPHA',
        name: 'V25 (1s) Bullish Alpha',
        market: '1HZ25V',
        symbol: '1HZ25V',
        volatility: '25 (1s)',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: '1HZ25V_BEARISH_ALPHA',
        name: 'V25 (1s) Bearish Alpha',
        market: '1HZ25V',
        symbol: '1HZ25V',
        volatility: '25 (1s)',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 50 Index
    {
        id: 'R50_BULLISH_ALPHA',
        name: 'V50 Bullish Alpha',
        market: 'R_50',
        symbol: 'R_50',
        volatility: '50',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: 'R50_BEARISH_ALPHA',
        name: 'V50 Bearish Alpha',
        market: 'R_50',
        symbol: 'R_50',
        volatility: '50',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 50 (1s) Index
    {
        id: '1HZ50V_BULLISH_ALPHA',
        name: 'V50 (1s) Bullish Alpha',
        market: '1HZ50V',
        symbol: '1HZ50V',
        volatility: '50 (1s)',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: '1HZ50V_BEARISH_ALPHA',
        name: 'V50 (1s) Bearish Alpha',
        market: '1HZ50V',
        symbol: '1HZ50V',
        volatility: '50 (1s)',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 75 Index
    {
        id: 'R75_BULLISH_ALPHA',
        name: 'V75 Bullish Alpha',
        market: 'R_75',
        symbol: 'R_75',
        volatility: '75',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: 'R75_BEARISH_ALPHA',
        name: 'V75 Bearish Alpha',
        market: 'R_75',
        symbol: 'R_75',
        volatility: '75',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 75 (1s) Index
    {
        id: '1HZ75V_BULLISH_ALPHA',
        name: 'V75 (1s) Bullish Alpha',
        market: '1HZ75V',
        symbol: '1HZ75V',
        volatility: '75 (1s)',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: '1HZ75V_BEARISH_ALPHA',
        name: 'V75 (1s) Bearish Alpha',
        market: '1HZ75V',
        symbol: '1HZ75V',
        volatility: '75 (1s)',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 100 Index
    {
        id: 'R100_BULLISH_ALPHA',
        name: 'V100 Bullish Alpha',
        market: 'R_100',
        symbol: 'R_100',
        volatility: '100',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: 'R100_BEARISH_ALPHA',
        name: 'V100 Bearish Alpha',
        market: 'R_100',
        symbol: 'R_100',
        volatility: '100',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },

    // Volatility 100 (1s) Index
    {
        id: '1HZ100V_BULLISH_ALPHA',
        name: 'V100 (1s) Bullish Alpha',
        market: '1HZ100V',
        symbol: '1HZ100V',
        volatility: '100 (1s)',
        confidence: 50,
        score: 50,
        direction: 'UP',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'CALL',
        status: 'high'
    },
    {
        id: '1HZ100V_BEARISH_ALPHA',
        name: 'V100 (1s) Bearish Alpha',
        market: '1HZ100V',
        symbol: '1HZ100V',
        volatility: '100 (1s)',
        confidence: 50,
        score: 50,
        direction: 'DOWN',
        recommendedStake: 1.00,
        recommendedStopLoss: 15.00,
        recommendedTakeProfit: 10.00,
        contractType: 'PUT',
        status: 'high'
    },
];

export const CORE_7_STRATEGIES = INITIAL_STRATEGIES;
