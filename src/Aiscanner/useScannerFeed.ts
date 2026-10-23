// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';

export const useScannerFeed = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Poll the active workspace or store where Deriv Bot keeps current market data
    const intervalId = setInterval(() => {
      try {
        const rootStore = (window as any).derivBotAppStore;
        
        // Check if the store has an active tick or quick strategy market price
        const currentSymbol = rootStore?.quick_strategy?.options?.symbol || 'R_10';
        const currentPrice = rootStore?.feed?.price || rootStore?.active_symbol?.price;

        if (currentPrice !== undefined && !isNaN(Number(currentPrice))) {
          ScannerBridge.pushTick(currentSymbol, Number(currentPrice));
        }
      } catch (e) {
        // Silent catch during store initialization
      }
    }, 1000); // Check every second

    // Keep backup event listeners just in case
    const handleGlobalTick = (event: CustomEvent) => {
      const { symbol, quote, price } = event.detail || {};
      const activeSymbol = symbol || 'R_10';
      const activeQuote = quote !== undefined ? quote : price;

      if (activeSymbol && activeQuote !== undefined) {
        ScannerBridge.pushTick(activeSymbol, Number(activeQuote));
      }
    };

    window.addEventListener('deriv_live_tick' as any, handleGlobalTick as EventListener);
    window.addEventListener('feed_tick' as any, handleGlobalTick as EventListener);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('deriv_live_tick' as any, handleGlobalTick as EventListener);
      window.removeEventListener('feed_tick' as any, handleGlobalTick as EventListener);
    };
  }, []);
};
