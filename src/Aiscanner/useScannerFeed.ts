// src/Aiscanner/useScannerFeed.ts
import { useEffect } from 'react';

export const useScannerFeed = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const TARGET_SYMBOL = 'R_10';
    const APP_ID = '34t7y3xkywoxWNnZuZFaB';
    
    // Instantiate a single worker thread for Vol 10
    const worker = new Worker(new URL('./scanner.worker.ts', import.meta.url));

    worker.onmessage = (event) => {
      const { symbol: eventSymbol, strategies } = event.data;
      
      // Guard against any mismatched events
      if (eventSymbol !== TARGET_SYMBOL) return;

      // Dispatch updates cleanly to your UI state via CustomEvent
      window.dispatchEvent(
        new CustomEvent('ai-strategies-updated', {
          detail: { symbol: eventSymbol, strategies },
        })
      );
    };

    // Send start message after listener is attached (symbol is now handled directly by the worker)
    worker.postMessage({ type: 'START_TRACKING', appId: APP_ID });

    // Cleanup function to prevent ghost connections and memory leaks
    return () => {
      worker.postMessage({ type: 'STOP_TRACKING' });
      worker.terminate();
    };
  }, []); // Empty dependency array ensures this runs once on mount
};
