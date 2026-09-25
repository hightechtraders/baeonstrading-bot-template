// src/Aiscanner/useDerivTicks.ts
import { useEffect, useState, useRef } from 'react';

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
  'R_10': 'R_10',
  'R_25': 'R_25',
  'R_50': 'R_50',
  'R_75': 'R_75',
  'R_100': 'R_100',
  '1HZ100V': '1HZ100V',
  '1HZ25V': '1HZ25V',
};

const SYMBOL_TO_ASSET: Record<string, string> = Object.entries(ASSET_TO_SYMBOL).reduce(
  (acc, [asset, symbol]) => {
    if (!acc[symbol]) acc[symbol] = asset;
    return acc;
  },
  {} as Record<string, string>
);

export function useDerivTicks(assets: string[]) {
  const [ticksBuffer, setTicksBuffer] = useState<Record<string, number[]>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Safe non-mutating copy for dependency comparison
  const serializedAssets = assets && assets.length > 0 ? [...assets].sort().join(',') : '';

  useEffect(() => {
    if (!assets || assets.length === 0) return;

    let isMounted = true;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(DERIV_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;

        // 1. Subscribe to requested tick streams
        assets.forEach((asset) => {
          const symbol = ASSET_TO_SYMBOL[asset] || ASSET_TO_SYMBOL[asset.trim()] || asset;
          ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        });

        // 2. Keep-alive ping every 25 seconds
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
            const rawSymbol = data.tick.symbol;
            const assetName = SYMBOL_TO_ASSET[rawSymbol] || rawSymbol;
            const price = Number(data.tick.quote);

            setTicksBuffer((prev) => {
              const currentSymbolTicks = prev[rawSymbol] || [];
              const currentAssetTicks = prev[assetName] || [];

              return {
                ...prev,
                [rawSymbol]: [...currentSymbolTicks, price].slice(-20),
                [assetName]: [...currentAssetTicks, price].slice(-20),
              };
            });
          }
        } catch (err) {
          console.error('Tick stream message parsing error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('Deriv WebSocket Error:', err);
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
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [serializedAssets]);

  return { ticksBuffer, ASSET_TO_SYMBOL };
}
