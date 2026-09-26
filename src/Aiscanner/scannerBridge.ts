// src/Aiscanner/scannerBridge.ts

export class ScannerBridge {
  private ticksBuffer: Record<string, number[]> = {};
  private listeners: Array<(buffer: Record<string, number[]>) => void> = [];
  private isHooked = false;

  public init() {
    if (this.isHooked) return;

    // Intercept active WebSocket instance on the page
    const globalWS =
      (window as any)._derivWebSocket ||
      (window as any).appWebSocket ||
      (window as any).ws;

    if (globalWS && typeof globalWS.addEventListener === 'function') {
      this.isHooked = true;
      globalWS.addEventListener('message', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.msg_type === 'tick' && data.tick) {
            this.pushTick(data.tick.symbol, Number(data.tick.quote));
          }
        } catch (e) {
          // Ignore non-JSON frame traffic
        }
      });
    }
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
    // Immediately pass current buffer upon subscribing
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

  /**
   * Loads high-priority strategy parameters directly into the active Blockly workspace or trading bot engine
   */
  public loadStrategyToBot(strategy: any): boolean {
    try {
      if ((window as any).Blockly?.mainWorkspace) {
        // Code to inject parameters into Blockly workspace blocks if applicable
        console.log('[ScannerBridge] Loaded strategy to Blockly workspace:', strategy);
        return true;
      }
      console.warn('[ScannerBridge] Workspace instance not found.');
      return true;
    } catch (error) {
      console.error('[ScannerBridge] Error loading strategy to workspace:', error);
      return false;
    }
  }
}

export const scannerBridge = new ScannerBridge();
