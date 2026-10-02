// src/Aiscanner/riskManager.ts
import { AudioAlerts } from './audioAlerts';

export class RiskManager {
  private static monitoredStopLoss: number = 0;
  private static monitoredTakeProfit: number = 0;
  private static cumulativeSessionPnL: number = 0;
  private static totalCycles: number = 0;
  public static liveExecutionLock: boolean = false;
  private static isInitialized: boolean = false;
  private static boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  public static configure(stopLoss?: number, takeProfit?: number): void {
    if (stopLoss !== undefined) {
      this.monitoredStopLoss = Number(stopLoss);
    }
    if (takeProfit !== undefined) {
      this.monitoredTakeProfit = Number(takeProfit);
    }
    // Reset session stats on new configuration
    this.cumulativeSessionPnL = 0;
    this.totalCycles = 0;
    this.liveExecutionLock = false;
    
    this.initPipeline();
  }

  public static initPipeline(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (!this.boundMessageHandler) {
      this.boundMessageHandler = (event: MessageEvent) => {
        try {
          const incomingFrame = JSON.parse(event.data);
          
          // Track proposal settlements or balance updates from Deriv API
          if (incomingFrame.msg_type === 'proposal_open_contract') {
            const contract = incomingFrame.proposal_open_contract;
            if (contract && (contract.is_expired || contract.status !== 'open')) {
              this.handleSettlement(contract);
            }
          }
        } catch (e) {}
      };

      const originalSend = window.WebSocket.prototype.send;
      window.WebSocket.prototype.send = function (...args) {
        if (!((this as any).__tredaHooked)) {
          (this as any).__tredaHooked = true;
          this.addEventListener('message', RiskManager.boundMessageHandler!);
        }
        return originalSend.apply(this, args);
      };
    }
  }

  private static handleSettlement(contractNode: any): void {
    const profit = parseFloat(contractNode.profit) || 0;
    this.cumulativeSessionPnL += profit;
    this.totalCycles += 1;

    console.log(`[RiskManager] Cycle ${this.totalCycles} Settled: $${profit.toFixed(2)} | Cumulative PnL: $${this.cumulativeSessionPnL.toFixed(2)}`);

    if (this.monitoredTakeProfit > 0 && this.cumulativeSessionPnL >= this.monitoredTakeProfit) {
      AudioAlerts.showModal('PROFIT', this.cumulativeSessionPnL, this.monitoredTakeProfit, this.totalCycles);
      this.haltOperations();
    } 
    else if (this.monitoredStopLoss > 0 && this.cumulativeSessionPnL <= -Math.abs(this.monitoredStopLoss)) {
      AudioAlerts.showModal('LOSS', this.cumulativeSessionPnL, this.monitoredStopLoss, this.totalCycles);
      this.haltOperations();
    }
  }

  private static haltOperations(): void {
    this.liveExecutionLock = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('EDASCORE_SYSTEM_RUN_TERMINATED', 'true');
    }

    // 1. Programmatically click Deriv's actual UI stop/red button to kill running trades immediately
    const nativeStopButtons = document.querySelectorAll(
      'button[class*="stop"], .cq-btn--red, button.run-btn--stop, .dbot-toolbar__stop-button'
    );
    nativeStopButtons.forEach((btn) => (btn as HTMLElement).click());

    // 2. Fallback global stop calls
    const globalWin = window as any;
    const coreApp = globalWin.derivRunner || globalWin.DBot || globalWin.Blockly?.derivWorkspace;
    if (coreApp && typeof coreApp.stopBot === 'function') {
      try { coreApp.stopBot(); } catch (e) {}
    }

    this.monitoredTakeProfit = 0;
    this.monitoredStopLoss = 0;
  }
}
