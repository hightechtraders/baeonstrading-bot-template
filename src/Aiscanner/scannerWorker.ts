// src/Aiscanner/scannerWorker.ts

import { ScannerEngine } from './scannerLogic';

const engine = new ScannerEngine();
let ws: WebSocket | null = null;

const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';

self.onmessage = (e: MessageEvent) => {
  const { type } = e.data || {};

  if (type === 'START_SCANNER') {
    if (ws) return;

    ws = new WebSocket(DERIV_WS_URL);

    ws.onopen = () => {
      // Subscribe to Volatility 25 index tick stream
      ws?.send(
        JSON.stringify({
          ticks: 'R_25',
          subscribe: 1,
        })
      );
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        if (data.msg_type === 'tick' && data.tick) {
          const tick = {
            quote: Number(data.tick.quote),
            epoch: Number(data.tick.epoch),
          };

          const results = engine.processTick('Volatility 25', tick);

          // Post updated rankings back to ScannerBridge
          self.postMessage({
            type: 'SCANNER_UPDATE',
            payload: results,
          });
        }
      } catch (err) {
        console.error('Error processing WebSocket tick:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('Scanner WebSocket Error:', error);
      ws?.close();
    };

    ws.onclose = () => {
      ws = null;
    };
  } else if (type === 'STOP_SCANNER') {
    if (ws) {
      ws.close();
      ws = null;
    }
  }
};
