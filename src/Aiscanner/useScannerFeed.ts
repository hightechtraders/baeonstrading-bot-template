// ==========================================
// FILE: src/Aiscanner/useScannerFeed.ts (Multi-Volatility Resilient Stream)
// ==========================================
import { useEffect } from 'react';
import { ScannerBridge } from './scannerBridge';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';

export const SCANNER_SYMBOLS = [
  'R_10',
  '1HZ10V',
  'R_25',
  '1HZ25V',
  'R_50',
  '1HZ50V',
  'R_75',
  '1HZ75V',
  'R_100',
  '1HZ100V',
];

const subscribedSymbols = new Set<string>();
const lastTickTimestamp: Record<string, number> = {};
let activeSocketRef: WebSocket | null = null;
let isBootstrapping = false;

const handleGlobalMessage = (event: MessageEvent) => {
  try {
    const data = JSON.parse(event.data);
    if (data?.msg_type === 'tick' && data?.tick?.symbol) {
      const sym = data.tick.symbol;
      if (!SCANNER_SYMBOLS.includes(sym)) return;

      const quote = Number(data.tick.quote);
      if (!Number.isNaN(quote)) {
        lastTickTimestamp[sym] = Date.now();
        subscribedSymbols.add(sym);
        ScannerBridge.pushTick(sym, quote);
      }
    }
  } catch {
    // Ignore non-JSON frames
  }
};

export const useScannerFeed = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let isMounted = true;

    const ensureSocketListener = () => {
      const currentSocket = api_base?.api?.connection;
      if (currentSocket && currentSocket !== activeSocketRef) {
        if (activeSocketRef) {
          activeSocketRef.removeEventListener('message', handleGlobalMessage);
        }
        activeSocketRef = currentSocket;
        activeSocketRef.addEventListener('message', handleGlobalMessage);
        // Socket reconnected — allow re-subscribing
        subscribedSymbols.clear();
      }
    };

    const setupFeed = async () => {
      while (!api_base?.api) {
        await new Promise(resolve => setTimeout(resolve, 200));
        if (!isMounted) return;
      }

      ensureSocketListener();

      if (isBootstrapping) return;
      isBootstrapping = true;

      try {
        for (const sym of SCANNER_SYMBOLS) {
          if (!isMounted) break;
          if (subscribedSymbols.has(sym)) continue;

          try {
            await api_base.api.send({
              ticks: sym,
              subscribe: 1,
            });
            subscribedSymbols.add(sym);
            lastTickTimestamp[sym] = Date.now();
          } catch (err: any) {
            if (err?.error?.code === 'AlreadySubscribed') {
              subscribedSymbols.add(sym);
              lastTickTimestamp[sym] = Date.now();
            } else {
              console.warn(`[AI Scanner]: Failed subscribing to ${sym}:`, err?.error?.message || err);
            }
          }

          // 250ms stagger prevents Deriv rate-limit drops
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      } finally {
        isBootstrapping = false;
      }
    };

    setupFeed();

    // Watchdog: re-attach listener if socket changed & auto-heal any feed silent > 8s
    const watchdog = setInterval(async () => {
      if (!api_base?.api) return;
      ensureSocketListener();

      const now = Date.now();
      for (const sym of SCANNER_SYMBOLS) {
        const lastSeen = lastTickTimestamp[sym] || 0;
        if (!subscribedSymbols.has(sym) || (lastSeen > 0 && now - lastSeen > 8000)) {
          subscribedSymbols.delete(sym);
          try {
            await api_base.api.send({ ticks: sym, subscribe: 1 });
            subscribedSymbols.add(sym);
            lastTickTimestamp[sym] = Date.now();
          } catch (err: any) {
            if (err?.error?.code === 'AlreadySubscribed') {
              subscribedSymbols.add(sym);
              lastTickTimestamp[sym] = Date.now();
            }
          }
        }
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(watchdog);
    };
  }, []);
};
