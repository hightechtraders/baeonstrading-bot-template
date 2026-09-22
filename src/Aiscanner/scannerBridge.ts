// src/Aiscanner/scannerBridge.ts

export class ScannerBridge {
  private worker: Worker | null = null;
  private onUpdateCallback: (data: any[]) => void;

  constructor(onUpdate: (data: any[]) => void) {
    this.onUpdateCallback = onUpdate;
  }

  /**
   * Spawns the Web Worker thread and begins receiving background scanner updates.
   */
  public startScanner() {
    if (this.worker) return;

    // Instantiate worker thread using module syntax for bundlers (Rspack / Vite / Webpack)
    this.worker = new Worker(new URL('./scannerWorker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'SCANNER_UPDATE') {
        this.onUpdateCallback(event.data.payload);
      }
    };

    this.worker.onerror = (error) => {
      console.error('Scanner Worker Error:', error);
    };

    // Send start signal to worker
    this.worker.postMessage({ type: 'START_SCANNER' });
  }

  /**
   * Sends stop signal and terminates the background worker thread.
   */
  public stopScanner() {
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP_SCANNER' });
      this.worker.terminate();
      this.worker = null;
    }
  }
}
