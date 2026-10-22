import { useEffect } from 'react';

export const useScannerFeed = () => {
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const markets = ['1HZ50V', 'R_25', '1HZ100V', '1HZ10V', '1HZ25V', '1HZ75V', 'R_50'];
        const activeWorkers: Worker[] = [];
        const APP_ID = '34t7y3xkywoxWNnZuZFaB';

        markets.forEach((symbol) => {
            // Instantiate an independent worker thread for each asset
            const worker = new Worker(new URL('./scanner.worker.ts', import.meta.url));
            
            worker.postMessage({ type: 'START_TRACKING', symbol, appId: APP_ID });

            worker.onmessage = (event) => {
                const { symbol, strategies } = event.data;
                // Dispatch updates cleanly to your UI state
                window.dispatchEvent(new CustomEvent('ai-strategies-updated', {
                    detail: { symbol, strategies }
                }));
            };

            activeWorkers.push(worker);
        });

        return () => {
            activeWorkers.forEach(w => w.terminate());
        };
    }, []);
};
