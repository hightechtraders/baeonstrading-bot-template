import { useEffect } from 'react';

export const useScannerFeed = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const markets = ['1HZ50V', 'R_25', '1HZ100V', '1HZ10V', '1HZ25V', '1HZ75V', 'R_50'];
    const APP_ID = '34t7y3xkywoxWNnZuZFaB';
    
    // Keep track of workers locally within the effect scope to avoid stale closures
    const activeWorkers: Worker[] = [];

    markets.forEach((symbol) => {
      // Instantiate an independent worker thread for each asset
      const worker = new Worker(new URL('./scanner.worker.ts', import.meta.url));

      worker.onmessage = (event) => {
        const { symbol: eventSymbol, strategies } = event.data;
        
        // Guard against race conditions where a terminated worker 
        // might still flush a lingering message
        if (!markets.includes(eventSymbol)) return;

        // Dispatch updates cleanly to your UI state via CustomEvent
        window.dispatchEvent(
          new CustomEvent('ai-strategies-updated', {
            detail: { symbol: eventSymbol, strategies },
          })
        );
      };

      // Send start message after listener is attached
      worker.postMessage({ type: 'START_TRACKING', symbol, appId: APP_ID });
      activeWorkers.push(worker);
    });

    // Cleanup function to prevent ghost connections and memory leaks
    return () => {
      activeWorkers.forEach((worker) => {
        worker.postMessage({ type: 'STOP_TRACKING' }); // Optional graceful shutdown hook for worker
        worker.terminate();
      });
    };
  }, []); // Empty dependency array ensures this runs once on mount
};
