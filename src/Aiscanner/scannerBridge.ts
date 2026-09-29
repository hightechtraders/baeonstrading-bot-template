export const ASSET_TO_SYMBOL: Record<string, string> = {
  'Volatility 10': 'R_10',
  'Volatility 25': 'R_25',
  'Volatility 50': 'R_50',
  'Volatility 75': 'R_75',
  'Volatility 100': 'R_100',
  'Volatility 100 (1s)': '1HZ100V',
};

export class ScannerBridge {
  private ticksBuffer: Record<string, number[]> = {};
  private listeners: Array<(buf: Record<string, number[]>) => void> = [];
  private activeWS: WebSocket | null = null;
  private isHooked = false;

  public init() {
    if (this.isHooked) return;
    const globalWS = (window as any)._derivWebSocket || (window as any).appWebSocket || (window as any).ws;

    if (globalWS?.addEventListener) {
      this.activeWS = globalWS;
      this.hookSocket(globalWS);
      this.isHooked = true;
      return;
    }

    const NativeWS = window.WebSocket;
    const self = this;
    window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
      const ws = new NativeWS(url, protocols);
      self.activeWS = ws;
      self.hookSocket(ws);
      return ws;
    } as any;
    window.WebSocket.prototype = NativeWS.prototype;
    this.isHooked = true;
  }

  private hookSocket(ws: WebSocket) {
    ws.addEventListener('open', () => this.subscribeAll());
    if (ws.readyState === WebSocket.OPEN) this.subscribeAll();

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.msg_type === 'tick' && data.tick) {
          const sym = data.tick.symbol;
          const price = Number(data.tick.quote);
          if (sym && !isNaN(price)) this.push(sym, price);
        }
      } catch {}
    });
  }

  private subscribeAll() {
    if (!this.activeWS || this.activeWS.readyState !== WebSocket.OPEN) return;
    Object.values(ASSET_TO_SYMBOL).forEach(sym => {
      this.activeWS?.send(JSON.stringify({ ticks: sym }));
    });
  }

  private push(sym: string, price: number) {
    const list = (this.ticksBuffer[sym] || []).concat(price).slice(-30);
    this.ticksBuffer[sym] = list;

    // Map back to strategy asset names
    Object.entries(ASSET_TO_SYMBOL).forEach(([asset, s]) => {
      if (s === sym) this.ticksBuffer[asset] = list;
    });

    this.listeners.forEach(cb => cb(this.ticksBuffer));
  }

  public subscribe(cb: (buf: Record<string, number[]>) => void) {
    this.listeners.push(cb);
    cb(this.ticksBuffer);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  }
}

export const scannerBridge = new ScannerBridge();
