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
        let connectionTimer: NodeJS.Timeout;

        const initLiveSubscription = () => {
            // Access the active WebSocket instance from the official template store or window context
            const ws = (window as any).derivBotAppStore?.client?.ws || (window as any).ws;

            if (ws && ws.readyState === WebSocket.OPEN) {
                // Subscribe to your target volatility indices
                TARGET_MARKETS.forEach((symbol) => {
                    ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
                });

                const handleMessage = (event: MessageEvent) => {
                    if (!isMounted) return;
                    try {
                        const data = JSON.parse(event.data);
                        
                        // Listen strictly for real-time incoming tick data packets
                        if (data.msg_type === 'tick' && data.tick) {
                            const { symbol, quote } = data.tick;
                            const assetName = SYMBOL_MAP[symbol] || symbol;
                            const numericQuote = Number(quote);

                            // 1. Push tick data to the workspace execution bridge
                            scannerBridge.pushTick(assetName, numericQuote, CORE_7_STRATEGIES);

                            // 2. Process the live tick through your real scanner math engine
                            const updatedStrategies = globalScanner.processLiveTick(symbol, numericQuote);

                            // 3. Broadcast updated scores to your Floating AI UI components
                            window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                                detail: { strategies: updatedStrategies }
                            }));

                            // 4. Trigger signal lock banner if top score meets high confidence
                            if (updatedStrategies[0]?.confidence >= 90) {
                                window.dispatchEvent(new CustomEvent('ai-signal-locked', {
                                    detail: { message: `🎯 ${updatedStrategies[0].confidence}% CONFIDENCE LOCKED (${assetName}): Ready to Load Strategy` }
                                }));
                            }
                        }
                    } catch (err) {
                        // Ignore non-tick frames or malformed JSON payload data
                    }
                };

                ws.addEventListener('message', handleMessage);

                return () => {
                    ws.removeEventListener('message', handleMessage);
                };
            }
        };

        // Check connection state every second until the WebSocket is fully open
        connectionTimer = setInterval(initLiveSubscription, 1000);

        return () => {
            isMounted = false;
            clearInterval(connectionTimer);
        };
    }, []);
};
