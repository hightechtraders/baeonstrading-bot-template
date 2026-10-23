// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';

export const useScannerFeed = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Listen to the native live tick events already firing in your platform
    const handleWorkspaceTick = (event: CustomEvent) => {
      const { symbol, quote, price } = event.detail || {};
      const activeSymbol = symbol || 'R_10';
      const activeQuote = quote !== undefined ? quote : price;

      if (activeSymbol && activeQuote !== undefined) {
        // Pass the live tick straight into the bridge and calculation engine
        ScannerBridge.pushTick(activeSymbol, Number(activeQuote));
      }
    };

    // Bind to your platform's existing tick event dispatcher
    window.addEventListener('deriv_live_tick' as any, handleWorkspaceTick as EventListener);
    window.addEventListener('feed_tick' as any, handleWorkspaceTick as EventListener);

    return () => {
      window.removeEventListener('deriv_live_tick' as any, handleWorkspaceTick as EventListener);
      window.removeEventListener('feed_tick' as any, handleWorkspaceTick as EventListener);
    };
  }, []);
};
