// src/Aiscanner/scannerBridge.ts

export class ScannerBridge {
  private ticksBuffer: Record<string, number[]> = {};
  private listeners: Array<(buffer: Record<string, number[]>) => void> = [];
  private isHooked = false;

  public init() {
    if (this.isHooked) return;

    // 1. Intercept Global WebSocket instance if already exposed
    const globalWS =
      (window as any)._derivWebSocket ||
      (window as any).appWebSocket ||
      (window as any).ws ||
      (window as any).DerivWS;

    if (globalWS && typeof globalWS.addEventListener === 'function') {
      this.attachWSListener(globalWS);
      return;
    }

    // 2. Monkey-patch WebSocket constructor to catch the active Deriv socket when initialized
    const NativeWebSocket = window.WebSocket;
    const self = this;

    window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
      const wsInstance = new NativeWebSocket(url, protocols);
      self.attachWSListener(wsInstance);
      return wsInstance;
    } as any;

    window.WebSocket.prototype = NativeWebSocket.prototype;
    this.isHooked = true;
  }

  private attachWSListener(ws: WebSocket) {
    ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        // Handle standard Deriv tick streams
        if (data.msg_type === 'tick' && data.tick) {
          const symbol = data.tick.symbol;
          const price = Number(data.tick.quote);
          if (symbol && !isNaN(price)) {
            this.pushTick(symbol, price);
          }
        }
        
        // Handle alternative proposal/ohlc tick feeds
        if (data.msg_type === 'ohlc' && data.ohlc) {
          const symbol = data.ohlc.symbol;
          const price = Number(data.ohlc.close);
          if (symbol && !isNaN(price)) {
            this.pushTick(symbol, price);
          }
        }
      } catch (e) {
        // Non-JSON WS frame
      }
    });
  }

  public pushTick(symbol: string, price: number) {
    const current = this.ticksBuffer[symbol] || [];
    this.ticksBuffer = {
      ...this.ticksBuffer,
      [symbol]: [...current, price].slice(-30),
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
