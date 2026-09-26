// src/Aiscanner/useDerivTicks.ts

import { useEffect, useState, useRef, useMemo } from 'react';

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

export const ASSET_TO_SYMBOL: Record<string, string> = {
  'Volatility 10': 'R_10',
  'Volatility 25': 'R_25',
  'Volatility 50': 'R_50',
  'Volatility 75': 'R_75',
  'Volatility 100': 'R_100',
  'Volatility 100 (1s)': '1HZ100V',
  'Volatility 25 (1s)': '1HZ25V',
  'Volatility 10 Index': 'R_10',
  'Volatility 25 Index': 'R_25',
  'Volatility 50 Index': 'R_50',
  'Volatility 75 Index': 'R_75',
  'Volatility 100 Index': 'R_100',
  'Volatility 100 (1s) Index': '1HZ100V',
  'Volatility 25 (1s) Index': '1HZ25V',
  'VOLATILITY 10': 'R_10',
  'VOLATILITY 25': 'R_25',
  'VOLATILITY 50': 'R_50',
  'VOLATILITY 75': 'R_75',
  'VOLATILITY 100': 'R_100',
  'VOLATILITY 100 (1S)': '1HZ100V',
  'VOLATILITY 25 (1S)': '1HZ25V',
  'R_10': 'R_10',
  'R_25': 'R_25',
  'R_50': 'R_50',
  'R_75': 'R_75',
  'R_100': 'R_100',
  '1HZ100V': '1HZ100V',
  '1HZ25V': '1HZ25V',
};

export const resolveSymbol = (asset: string): string => {
  if (!asset) return '1HZ100V';
  const clean = asset.trim().toUpperCase();

  if (ASSET_TO_SYMBOL[asset]) return ASSET_TO_SYMBOL[asset];
  if (ASSET_TO_SYMBOL[clean]) return ASSET_TO_SYMBOL[clean];

  if (clean.includes('100') && (clean.includes('1S') || clean.includes('(1S)'))) return '1HZ100V';
  if (clean.includes('25') && (clean.includes('1S') || clean.includes('(1S)'))) return '1HZ25V';
  if (clean.includes('10')) return 'R_10';
  if (clean.includes('25')) return 'R_25';
  if (clean.includes('50')) return 'R_50';
  if (clean.includes('75')) return 'R_75';
  if (clean.includes('100')) return 'R_100';

  return asset;
};

export function useDerivTicks(assets: string[]) {
  const [ticksBuffer, setTicksBuffer] = useState<Record<string, number[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derive normalized symbol array to ensure unique subscription list
  const activeSymbols = useMemo(() => {
    if (!assets || assets.length === 0) return [];
    const set = new Set(assets.map((a) => resolveSymbol(a)));
    return Array.from(set);
  }, [assets]);

  const symbolsKey = activeSymbols.join(',');

  useEffect(() => {
    if (!symbolsKey) return;

    let isMounted = true;

    const connect = () => {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(DERIV_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;

        console.log('[Deriv WS] Connected. Subscribing to symbols:', activeSymbols);

        // Stagger subscriptions slightly so Deriv API processes each tick stream smoothly
        activeSymbols.forEach((sym, idx) => {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ ticks: sym, subscribe: 1 }));
            }
          }, idx * 100);
        });

        // Maintain WebSocket connection with 25s keepalive ping
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.msg_type === 'tick' && data.tick) {
            const rawSymbol = data.tick.symbol; // e.g. "R_25"
            const price = Number(data.tick.quote);

            setTicksBuffer((prev) => {
              const currentTicks = prev[rawSymbol] || [];
              const updatedTicks = [...currentTicks, price].slice(-30);

              const updatedBuffer: Record<string, number[]> = {
                ...prev,
                [rawSymbol]: updatedTicks,
              };

              // Map prices back across all asset keys so scanner components receive updates regardless of asset name format
              Object.entries(ASSET_TO_SYMBOL).forEach(([assetKey, mappedSym]) => {
                if (mappedSym === rawSymbol) {
                  updatedBuffer[assetKey] = updatedTicks;
                  updatedBuffer[assetKey.toUpperCase()] = updatedTicks;
                }
              });

              return updatedBuffer;
            });
          }
        } catch (err) {
          console.error('[Deriv WS] Tick parsing error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[Deriv WS] Connection error:', err);
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [symbolsKey]);

  return { ticksBuffer, ASSET_TO_SYMBOL };
}
