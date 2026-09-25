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
};

export function useDerivTicks(assets: string[]) {
  const [ticksBuffer, setTicksBuffer] = useState<Record<string, number[]>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!assets || assets.length === 0) return;

    const ws = new WebSocket(DERIV_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      assets.forEach((asset) => {
        const symbol = ASSET_TO_SYMBOL[asset] || '1HZ100V';
        ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'tick' && data.tick) {
          const symbol = data.tick.symbol;
          const price = Number(data.tick.quote);

          setTicksBuffer((prev) => {
            const current = prev[symbol] || [];
            // Keep rolling buffer of last 20 ticks for logic evaluation
            return { ...prev, [symbol]: [...current, price].slice(-20) };
          });
        }
      } catch (err) {
        console.error('Tick stream error:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [JSON.stringify(assets)]);

  return { ticksBuffer, ASSET_TO_SYMBOL };
}
