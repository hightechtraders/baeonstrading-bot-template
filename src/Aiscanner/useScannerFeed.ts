// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';

export const useScannerFeed = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen to whatever custom event your platform uses to broadcast live ticks
    const handleGlobalTick = (event: CustomEvent) => {
      const { symbol, quote, price } = event.detail || {};
      const activeSymbol = symbol || 'R_10';
      const activeQuote = quote !== undefined ? quote : price;

      if (activeSymbol && activeQuote !== undefined) {
        // Directly push the tick into the bridge (which automatically calls ScannerLogic)
        ScannerBridge.pushTick(activeSymbol, Number(activeQuote));
      }
    };

    window.addEventListener('deriv_live_tick' as any, handleGlobalTick as EventListener);
    window.addEventListener('feed_tick' as any, handleGlobalTick as EventListener);

    return () => {
      window.removeEventListener('deriv_live_tick' as any, handleGlobalTick as EventListener);
      window.removeEventListener('feed_tick' as any, handleGlobalTick as EventListener);
    };
  }, []);
};
