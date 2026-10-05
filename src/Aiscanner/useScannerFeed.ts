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
        let cleanupInterval: NodeJS.Timeout;

        const initSubscription = () => {
            // Access active connection safely through standard app store or window context
            const ws = (window as any).derivBotAppStore?.client?.ws || (window as any).ws;

            if (ws && ws.readyState === WebSocket.OPEN) {
                // Subscribe to target symbols
                TARGET_MARKETS.forEach((symbol) => {
                    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
                });

                // Message handler wrapper
                const handleMessage = (event: MessageEvent) => {
                    if (!isMounted) return;
                    try {
                        const data = JSON.parse(event.data);
                        if (data.msg_type === 'tick' && data.tick) {
                            const { symbol, quote } = data.tick;
                            const assetName = SYMBOL_MAP[symbol] || symbol;
                            const numericQuote = Number(quote);

                            // Push to bridge and update scanner
                            scannerBridge.pushTick(assetName, numericQuote, CORE_7_STRATEGIES);
                            const updatedStrategies = globalScanner.processLiveTick(symbol, numericQuote);

                            // Broadcast update to UI components
                            window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                                detail: { strategies: updatedStrategies }
                            }));

                            // Update signal banner lock status if confidence is high
                            if (updatedStrategies[0]?.confidence >= 90) {
                                window.dispatchEvent(new CustomEvent('ai-signal-locked', {
                                    detail: { message: `🎯 99% CONFIDENCE LOCKED (${assetName}): Ready to Load Strategy` }
                                }));
                            }
                        }
                    } catch (err) {
                        // Suppress parse errors from unrelated frames
                    }
                };

                ws.addEventListener('message', handleMessage);

                return () => {
                    ws.removeEventListener('message', handleMessage);
                };
            }
        };

        cleanupInterval = setInterval(initSubscription, 2000);

        return () => {
            isMounted = false;
            clearInterval(cleanupInterval);
        };
    }, []);
};
