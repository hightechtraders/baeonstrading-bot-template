// src/Aiscanner/scannerBridge.ts
import { ASSET_TO_SYMBOL } from './useDerivTicks';

export class ScannerBridge {
  private ticksBuffer: Record<string, number[]> = {};
  private listeners: Array<(buffer: Record<string, number[]>) => void> = [];
  private isHooked = false;
  private activeWS: WebSocket | null = null;
  private subscribedSymbols = new Set<string>();

  public init() {
    if (this.isHooked) return;

    const globalWS =
      (window as any)._derivWebSocket ||
      (window as any).appWebSocket ||
      (window as any).ws;

    if (globalWS && typeof globalWS.addEventListener === 'function') {
      this.activeWS = globalWS;
      this.attachWSListener(globalWS);
      this.subscribeAllAssets();
      this.isHooked = true;
      return;
    }

    const NativeWebSocket = window.WebSocket;
    const self = this;

    window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
      const wsInstance = new NativeWebSocket(url, protocols);
      self.activeWS = wsInstance;
      self.attachWSListener(wsInstance);

      wsInstance.addEventListener('open', () => {
        self.subscribeAllAssets();
      });

      return wsInstance;
    } as any;

    window.WebSocket.prototype = NativeWebSocket.prototype;
    this.isHooked = true;
  }

  public subscribeAllAssets() {
    const sendSubscriptions = () => {
      if (!this.activeWS || this.activeWS.readyState !== WebSocket.OPEN) return;

      const symbols = Array.from(new Set(Object.values(ASSET_TO_SYMBOL)));
      symbols.forEach((symbol) => {
        if (!this.subscribedSymbols.has(symbol)) {
          this.subscribedSymbols.add(symbol);
          this.activeWS?.send(JSON.stringify({ ticks: symbol }));
        }
      });
    };

    if (this.activeWS && this.activeWS.readyState === WebSocket.OPEN) {
      sendSubscriptions();
    } else {
      setTimeout(sendSubscriptions, 1000);
    }
  }

  private attachWSListener(ws: WebSocket) {
    ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.msg_type === 'tick' && data.tick) {
          const symbol = data.tick.symbol;
          const price = Number(data.tick.quote);
          if (symbol && !isNaN(price)) {
            this.pushTick(symbol, price);
          }
        }
      } catch (e) {
        // Non-JSON frame
      }
    });
  }

  public pushTick(symbol: string, price: number) {
    const currentSymbolTicks = this.ticksBuffer[symbol] || [];
    const updatedSymbolTicks = [...currentSymbolTicks, price].slice(-30);

    const mappedEntries: Record<string, number[]> = {
      [symbol]: updatedSymbolTicks,
    };

    Object.entries(ASSET_TO_SYMBOL).forEach(([assetName, sym]) => {
      if (sym === symbol) {
        mappedEntries[assetName] = updatedSymbolTicks;
      }
    });

    this.ticksBuffer = {
      ...this.ticksBuffer,
      ...mappedEntries,
    };

    this.notify();
  }

  public subscribe(cb: (buffer: Record<string, number[]>) => void) {
    this.listeners.push(cb);
    cb(this.ticksBuffer);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.ticksBuffer));
  }

  public getTicksBuffer() {
    return this.ticksBuffer;
  }

  public loadStrategyToBot(strategy: any): boolean {
    return true;
  }
}

export const scannerBridge = new ScannerBridge();
