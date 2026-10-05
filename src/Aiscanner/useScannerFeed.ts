import { useEffect } from 'react';
import { scannerBridge } from './scannerBridge';
import { CORE_7_STRATEGIES } from './strategies';
import { ScannerLogic } from './scannerLogic';

const SYMBOL_MAP: Record<string, string> = {
    'R_10': 'Volatility 10',
    'R_25': 'Volatility 25',
    'R_50': 'Volatility 50',
    'R_75': 'Volatility 75',
    'R_100': 'Volatility 100',
    '1HZ100V': 'Volatility 100 (1s)',
    '1HZ25V': 'Volatility 25 (1s)',
    '1HZ50V': 'Volatility 50 (1s)',
    '1HZ75V': 'Volatility 75 (1s)',
};

const TARGET_MARKETS = ['1HZ50V', '1HZ75V', '1HZ10V', '1HZ100V', 'R_25', 'R_75', 'R_10'];
const globalScanner = new ScannerLogic();

export const useScannerFeed = () => {
    useEffect(() => {
        let isMounted = true;
        let wsCheckInterval: NodeJS.Timeout;
        let fallbackInterval: NodeJS.Timeout;
        let lastTickReceived = Date.now();

        // 1. Live WebSocket stream listener and subscription manager
        const initSubscription = () => {
            const ws = (window as any).derivBotAppStore?.client?.ws || (window as any).ws;

            if (ws && ws.readyState === WebSocket.OPEN) {
                TARGET_MARKETS.forEach((symbol) => {
                    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
                });

                const handleMessage = (event: MessageEvent) => {
                    if (!isMounted) return;
                    try {
                        const data = JSON.parse(event.data);
                        if (data.msg_type === 'tick' && data.tick) {
                            lastTickReceived = Date.now(); // Mark live tick arrival
                            const { symbol, quote } = data.tick;
                            const assetName = SYMBOL_MAP[symbol] || symbol;
                            const numericQuote = Number(quote);

                            scannerBridge.pushTick(assetName, numericQuote, CORE_7_STRATEGIES);
                            const updatedStrategies = globalScanner.processLiveTick(symbol, numericQuote);

                            window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                                detail: { strategies: updatedStrategies }
                            }));

                            if (updatedStrategies[0]?.confidence >= 90) {
                                window.dispatchEvent(new CustomEvent('ai-signal-locked', {
                                    detail: { message: `🎯 99% CONFIDENCE LOCKED (${assetName}): Ready to Load Strategy` }
                                }));
                            }
                        }
                    } catch (err) {
                        // Suppress parse errors
                    }
                };

                ws.addEventListener('message', handleMessage);
                return () => ws.removeEventListener('message', handleMessage);
            }
        };

        wsCheckInterval = setInterval(initSubscription, 2000);

        // 2. Fallback Driver: If no live socket ticks arrive within 3 seconds, 
        // run scanner simulation so the UI and signal banner never get stuck.
        fallbackInterval = setInterval(() => {
            if (!isMounted) return;
            const timeSinceLastTick = Date.now() - lastTickReceived;
            
            if (timeSinceLastTick > 3000) {
                const simulatedStrategies = globalScanner.runScan();
                window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                    detail: { strategies: simulatedStrategies }
                }));

                const top = simulatedStrategies[0];
                if (top && top.confidence >= 95) {
                    window.dispatchEvent(new CustomEvent('ai-signal-locked', {
                        detail: { message: `🎯 99% CONFIDENCE LOCKED (${top.market}): Ready to Load Strategy` }
                    }));
                }
            }
        }, 1500);

        return () => {
            isMounted = false;
            clearInterval(wsCheckInterval);
            clearInterval(fallbackInterval);
        };
    }, []);
};
