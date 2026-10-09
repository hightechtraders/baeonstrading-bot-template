// src/Aiscanner/riskManager.ts
import { AudioAlerts } from './audioAlerts';

export class RiskManager {
  private static monitoredStopLoss: number = 0;
  private static monitoredTakeProfit: number = 0;
  private static cumulativeSessionPnL: number = 0;
  private static totalCycles: number = 0;
  private static consecutiveLosses: number = 0;
  private static readonly MAX_MARTINGALE_STEPS: number = 3; // Strict cap to prevent runaway drawdowns
  private static processedContractIds: Set<string> = new Set();
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
    // Reset session stats and history on new configuration
    this.cumulativeSessionPnL = 0;
    this.totalCycles = 0;
    this.consecutiveLosses = 0;
    this.processedContractIds.clear();
    this.liveExecutionLock = false;
    
    this.initPipeline();
  }

  public static initPipeline(): void {
    if (this.isInitialized) {
      this.suppressNativeAlerts();
      return;
    }
    this.isInitialized = true;

    // Suppress unwanted native browser alerts globally
    this.suppressNativeAlerts();

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

  private static suppressNativeAlerts(): void {
    if (typeof window === 'undefined') return;
    const originalAlert = window.alert;
    window.alert = function (message?: any) {
      const msgStr = String(message || '').toLowerCase();
      // Block native browser popups so only the custom UI renders
      if (
        msgStr.includes('profit threshold') || 
        msgStr.includes('drawdown') || 
        msgStr.includes('circuit breaker') ||
        msgStr.includes('profit') ||
        msgStr.includes('loss')
      ) {
        console.log('[RiskManager] Suppressed native browser alert:', message);
        return;
      }
      return originalAlert.apply(window, arguments);
    };
  }

  private static handleSettlement(contractNode: any): void {
    const contractId = String(contractNode.contract_id || '');
    
    // Guard against duplicate WebSocket frames for the exact same contract ID
    if (contractId && this.processedContractIds.has(contractId)) {
      return;
    }
    if (contractId) {
      this.processedContractIds.add(contractId);
    }

    const profit = parseFloat(contractNode.profit) || 0;
    const isWin = profit > 0;

    // Track consecutive losses for martingale capping
    if (isWin) {
      this.consecutiveLosses = 0;
    } else {
      this.consecutiveLosses += 1;
      if (this.consecutiveLosses >= this.MAX_MARTINGALE_STEPS) {
        console.warn(`[RiskManager] Max Martingale recovery step (${this.MAX_MARTINGALE_STEPS}) reached! Forcing stake reset.`);
        // Signal platform to reset stake multiplier back to base level
        const globalWin = window as any;
        if (globalWin.derivBotAppStore && typeof globalWin.derivBotAppStore.resetMultiplier === 'function') {
          globalWin.derivBotAppStore.resetMultiplier();
        }
      }
    }
    
    // Synchronize with the live platform summary element if available
    const summaryProfitEl = document.querySelector('[class*="total-profit"], [class*="pnl"]');
    if (summaryProfitEl && summaryProfitEl.textContent) {
      const parsedSummary = parseFloat(summaryProfitEl.textContent.replace(/[^0-9.-]+/g, ""));
      if (!isNaN(parsedSummary)) {
        this.cumulativeSessionPnL = parsedSummary;
      } else {
        this.cumulativeSessionPnL += profit;
      }
    } else {
      this.cumulativeSessionPnL += profit;
    }

    this.totalCycles += 1;

    console.log(`[RiskManager] Cycle ${this.totalCycles} Settled (ID: ${contractId}): $${profit.toFixed(2)} | Synchronized PnL: $${this.cumulativeSessionPnL.toFixed(2)} | Streak Losses: ${this.consecutiveLosses}`);

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

    // 1. Target Deriv's core bot application stores directly
    const globalWin = window as any;
    const botStore = globalWin.derivBotAppStore || globalWin.DBotStore;
    if (botStore) {
      try {
        if (typeof botStore.stopBot === 'function') botStore.stopBot();
        if (botStore.running_state && typeof botStore.running_state.stop === 'function') {
          botStore.running_state.stop();
        }
      } catch (e) {}
    }

    // 2. Target Workspace runner state if available
    const coreApp = globalWin.derivRunner || globalWin.DBot || globalWin.Blockly?.derivWorkspace;
    if (coreApp && typeof coreApp.stopBot === 'function') {
      try { coreApp.stopBot(); } catch (e) {}
    }

    // 3. Comprehensive DOM button scan for red stop buttons
    const stopButtons = document.querySelectorAll(
      'button[class*="stop"], .cq-btn--red, button.run-btn--stop, .dbot-toolbar__stop-button, [data-testid="stop-button"]'
    );
    stopButtons.forEach((btn) => (btn as HTMLElement).click());

    // 4. Broad text-based fallback search for any button labeled "Stop"
    const allButtons = document.querySelectorAll('button');
    allButtons.forEach((btn) => {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text === 'stop' || text.includes('stop bot')) {
        (btn as HTMLElement).click();
      }
    });

    this.monitoredTakeProfit = 0;
    this.monitoredStopLoss = 0;
  }
}
