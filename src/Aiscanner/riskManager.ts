// src/Aiscanner/riskManager.ts
import { AudioAlerts } from './audioAlerts';

export class RiskManager {
  private static monitoredStopLoss: number = 0;
  private static monitoredTakeProfit: number = 0;
  private static cumulativeSessionPnL: number = 0;
  public static liveExecutionLock: boolean = false;
  private static isInitialized: boolean = false;
  private static boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  public static configure(stopLoss?: number, takeProfit?: number): void {
    if (stopLoss !== undefined) {
      this.monitoredStopLoss = Number(stopLoss);
      this.cumulativeSessionPnL = 0; // Reset cumulative balance on new run
    }
    if (takeProfit !== undefined) {
      this.monitoredTakeProfit = Number(takeProfit);
    }
    this.initPipeline();
  }

  public static initPipeline(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (!this.boundMessageHandler) {
      this.boundMessageHandler = (event: MessageEvent) => {
        try {
          const incomingFrame = JSON.parse(event.data);
          if (incomingFrame.msg_type === 'proposal_open_contract') {
            const contract = incomingFrame.proposal_open_contract;
            if (contract && (contract.is_expired || contract.status !== 'open')) {
              this.handleSettlement(contract);
            }
          }
        } catch (e) {}
      };

      // Native WebSocket prototype hook guarantees settlement capture
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
    const runs = contractNode.transaction_ids?.length || 8;

    this.liveExecutionLock = false;

    console.log(`[RiskManager] Settled: $${profit.toFixed(2)} | Cumulative PnL: $${this.cumulativeSessionPnL.toFixed(2)}`);

    if (this.monitoredTakeProfit > 0 && this.cumulativeSessionPnL >= this.monitoredTakeProfit) {
      AudioAlerts.showModal('PROFIT', this.cumulativeSessionPnL, this.monitoredTakeProfit, runs);
      this.haltOperations();
    } 
    else if (this.monitoredStopLoss > 0 && this.cumulativeSessionPnL <= -Math.abs(this.monitoredStopLoss)) {
      AudioAlerts.showModal('LOSS', this.cumulativeSessionPnL, this.monitoredStopLoss, runs);
      this.haltOperations();
    }
  }

  private static haltOperations(): void {
    this.liveExecutionLock = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('EDASCORE_SYSTEM_RUN_TERMINATED', 'true');
    }
    const globalWin = window as any;
    const coreApp = globalWin.derivRunner || globalWin.DBot || globalWin.Blockly?.derivWorkspace;
    if (coreApp && typeof coreApp.stopBot === 'function') coreApp.stopBot();
    this.monitoredTakeProfit = 0;
    this.monitoredStopLoss = 0;
  }
}
