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

  // Derive unique array of normalized market symbols
  const activeSymbols = useMemo(() => {
    if (!assets || assets.length === 0) return [];
    const uniqueSymbols = new Set(assets.map((asset) => resolveSymbol(asset)));
    return Array.from(uniqueSymbols);
  }, [assets]);

  useEffect(() => {
    if (activeSymbols.length === 0) return;

    let isComponentMounted = true;

    const connect = () => {
      // Safely close existing connection before creating a new one
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(DERIV_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isComponentMounted) return;

        // Subscribe to each symbol with small delay to avoid rate-limiting
        activeSymbols.forEach((symbol, index) => {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
            }
          }, index * 50);
        });

        // Keep-alive ping every 25 seconds
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
            const rawSymbol = data.tick.symbol;
            const assetName = SYMBOL_TO_ASSET[rawSymbol] || rawSymbol;
            const price = Number(data.tick.quote);

            setTicksBuffer((prev) => {
              const currentSymbolTicks = prev[rawSymbol] || [];
              const currentAssetTicks = prev[assetName] || [];

              const updatedSymbolTicks = [...currentSymbolTicks, price].slice(-20);
              const updatedAssetTicks = [...currentAssetTicks, price].slice(-20);

              return {
                ...prev,
                [rawSymbol]: updatedSymbolTicks,
                [assetName]: updatedAssetTicks,
                [assetName.toUpperCase()]: updatedAssetTicks,
              };
            });
          }
        } catch (err) {
          console.error('Tick parsing error:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('Deriv WebSocket Error:', err);
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        if (isComponentMounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [activeSymbols.join(',')]);

  return { ticksBuffer, ASSET_TO_SYMBOL };
}
