// src/Aiscanner/scannerBridge.ts

export interface AIScannerPayload {
  stake: number;
  duration: number;
  symbol: string;          
  tradeType?: string;      
  durationUnit?: string;   
  stopLoss?: number;
  takeProfit?: number;
}

export class ScannerBridge {
  private static activeListener: any = null;
  private static isScannerActive: boolean = false; // Keeps workspace untouched on initial boot

  // Circuit Breaker & Execution Tracking State
  public static liveExecutionLock: boolean = false;
  private static monitoredStopLoss: number = 0;
  private static monitoredTakeProfit: number = 0;
  private static boundMessageHandler: ((event: MessageEvent) => void) | null = null;

  private static translateSymbol(rawSymbol: string): string {
    if (!rawSymbol || typeof rawSymbol !== 'string') return '1HZ100V';
    
    const clean = rawSymbol
      .toUpperCase()
      .replace(/INDEX/g, '')
      .replace(/[\s\(\)]+/g, '');
    
    const symbolMap: Record<string, string> = {
      'VOLATILITY101S':  '1HZ10V',
      'VOLATILITY501S': '1HZ50V',
      'VOLATILITY751S': '1HZ75V',
      'VOLATILITY1001S':'1HZ100V',
      'VOLATILITY10':     'R_10',
      'VOLATILITY25':     'R_25',
      'VOLATILITY50':     'R_50',
      'VOLATILITY75':     'R_75',
      'VOLATILITY100':    'R_100',
    };

    return symbolMap[clean] || '1HZ100V';
  }

  /**
   * Initializes the WebSocket listener for live contract settlements and circuit breaker tracking.
   */
  public static initPipeline(): void {
    const globalWin = window as any;
    const ws = globalWin.derivWebSocket || globalWin.ws || globalWin.socket || globalWin.Blockly?.derivWorkspace?.socket || globalWin.derivBotAppStore?.websocketInstance;

    if (ws && ws.readyState === WebSocket.OPEN && !this.boundMessageHandler) {
      this.boundMessageHandler = (event: MessageEvent) => {
        try {
          const incomingFrame = JSON.parse(event.data);
          
          if (incomingFrame.msg_type === 'proposal_open_contract') {
            const contract = incomingFrame.proposal_open_contract;
            if (contract && (contract.is_expired || contract.status !== 'open')) {
              console.log(`[ScannerBridge] Contract settlement verified: $${contract.profit}`);
              this.handleContractSettlementEvent(contract);
            }
          }
        } catch (e) {
          // Silent parse catch
        }
      };
      ws.addEventListener('message', this.boundMessageHandler);
    }
  }

  public static handleContractSettlementEvent(contractNode: any): void {
    if (!contractNode) return;

    const currentFloatingPnL = parseFloat(contractNode.profit) || 0;
    const activeRunsCount = contractNode.transaction_ids?.length || 8;

    // Release execution barrier instantly upon cycle settlement
    this.liveExecutionLock = false;

    if (this.monitoredTakeProfit > 0 && currentFloatingPnL >= this.monitoredTakeProfit) {
      this.triggerTopTierAlertOverlay('PROFIT', currentFloatingPnL, this.monitoredTakeProfit, activeRunsCount);
      this.emergencyHaltOperations();
    } 
    else if (this.monitoredStopLoss > 0 && currentFloatingPnL <= -Math.abs(this.monitoredStopLoss)) {
      this.triggerTopTierAlertOverlay('LOSS', currentFloatingPnL, this.monitoredStopLoss, activeRunsCount);
      this.emergencyHaltOperations();
    }
  }

  private static playPremiumSynthesizerChime(style: 'SUCCESS_RISE' | 'ALERT_ECHO'): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      const now = ctx.currentTime;

      if (style === 'SUCCESS_RISE') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); 
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); 
        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.55);
        osc.start(now); osc.stop(now + 0.55);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220.00, now); 
        gainNode.gain.setValueAtTime(0.35, now);
        gainNode.gain.linearRampToValueAtTime(0.001, now + 0.45);
        osc.start(now); osc.stop(now + 0.45);
      }
    } catch (e) {}
  }

  private static triggerTopTierAlertOverlay(type: 'PROFIT' | 'LOSS', balance: number, limit: number, activeRunsCount: number | string): void {
    const existingModal = document.getElementById('treda-circuit-breaker-modal');
    if (existingModal) existingModal.remove();

    const isProfit = type === 'PROFIT';
    const primaryColor = isProfit ? '#2ed479' : '#ff4a62';
    const glowColor = isProfit ? 'rgba(46, 212, 121, 0.2)' : 'rgba(255, 74, 98, 0.2)';
    
    this.playPremiumSynthesizerChime(isProfit ? 'SUCCESS_RISE' : 'ALERT_ECHO');

    const backdrop = document.createElement('div');
    backdrop.id = 'treda-circuit-breaker-modal';
    Object.assign(backdrop.style, {
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      backgroundColor: 'rgba(5, 7, 13, 0.85)', backdropFilter: 'blur(6px)',
      zIndex: '100000', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', boxSizing: 'border-box', opacity: '0', transition: 'opacity 0.25s ease'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
      background: '#0e111a', border: `1px solid ${primaryColor}`, borderRadius: '14px',
      width: '100%', maxWidth: '340px', padding: '24px 20px', boxSizing: 'border-box',
      textAlign: 'center', boxShadow: `0 10px 40px ${glowColor}`, transform: 'scale(0.9)',
      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: '-apple-system, sans-serif'
    });

    card.innerHTML = `
      <div style="color: #6c718c; font-size: 10px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 6px;">
        🌐 tredascore.pro says:
      </div>
      <div style="font-size: 32px; margin-bottom: 12px;">${isProfit ? '🏆' : '🛑'}</div>
      <h2 style="color: #ffffff; font-size: 18px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase;">
        ${isProfit ? 'Target Profit Breach' : 'Drawdown Breached'}
      </h2>
      <p style="color: #6c718c; font-size: 11px; margin: 0 0 20px 0;">Automated circuit breaker deployed.</p>
      <div style="background: #141824; border: 1px solid #1e2335; border-radius: 8px; padding: 12px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Session Balance:</span>
          <span style="font-weight: bold; color: ${primaryColor};">${isProfit ? '+' : '-'}$${Math.abs(balance).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Trigger Target:</span>
          <span style="font-weight: bold; color: #ffffff;">$${limit.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px;">
          <span style="color: #6c718c;">Total Cycle Runs:</span>
          <span style="font-weight: bold; color: #f5a623;">${activeRunsCount} Cycles</span>
        </div>
      </div>
      <button id="close-breaker-modal-btn" style="width: 100%; background: #1c2035; border: 1px solid #2d3450; color: #ffffff; padding: 12px; font-size: 12px; font-weight: bold; border-radius: 6px; cursor: pointer;">
        ACKNOWLEDGE & DISMISS
      </button>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
    setTimeout(() => { backdrop.style.opacity = '1'; card.style.transform = 'scale(1)'; }, 10);

    const dismissModal = () => {
      backdrop.style.opacity = '0'; card.style.transform = 'scale(0.9)';
      setTimeout(() => {
        backdrop.remove();
        const el = document.querySelector('#id-dashboard') || document.querySelector('.dbot-tab__dashboard');
        if (el) (el as HTMLElement).click();
      }, 250);
    };

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) dismissModal(); });
    card.querySelector('#close-breaker-modal-btn')?.addEventListener('click', dismissModal);
  }

  private static emergencyHaltOperations(): void {
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

  public static injectViaStore(payload: AIScannerPayload): boolean {
    ScannerBridge.isScannerActive = true;

    // Cache risk limits for the real-time settlement listener
    if (payload.stopLoss) this.monitoredStopLoss = Number(payload.stopLoss);
    if (payload.takeProfit) this.monitoredTakeProfit = Number(payload.takeProfit);

    // Boot up the live WebSocket listener pipeline
    this.initPipeline();

    const rootStore = (window as any).derivBotAppStore;
    const strictDerivSymbol = this.translateSymbol(payload.symbol);
    
    const rawTradeType = (payload.tradeType || 'rise').toLowerCase();
    const isFall = rawTradeType.includes('down') || rawTradeType.includes('put') || rawTradeType.includes('fall');
    
    const storeContractType = isFall ? 'PUT' : 'CALL';
    const storeType = isFall ? 'fall' : 'rise';
    const martingaleMultiplier = 2.4;

    console.log(`[ScannerBridge] Activating Strategy -> Symbol: ${strictDerivSymbol} | Direction: ${storeContractType} | TP: ${this.monitoredTakeProfit} | SL: ${this.monitoredStopLoss}`);

    // 1. Update the Quick Strategy Store State
    if (rootStore?.quick_strategy) {
      const quickStrategy = rootStore.quick_strategy;
      try {
        if (typeof quickStrategy.setValue === 'function') {
          quickStrategy.setValue('symbol', strictDerivSymbol);
          quickStrategy.setValue('duration', payload.duration);
          quickStrategy.setValue('amount', payload.stake);
          quickStrategy.setValue('contract_type', storeContractType);
          quickStrategy.setValue('type', storeType);
          quickStrategy.setValue('size', martingaleMultiplier);
        }
        
        const mockFormData = {
          symbol: strictDerivSymbol, 
          durationtype: payload.durationUnit || 't', 
          duration: payload.duration,
          stake: payload.stake,
          amount: payload.stake,
          tradetype: 'rise_fall',
          contract_type: storeContractType,
          type: storeType,
          size: martingaleMultiplier
        };

        const submitAction = quickStrategy.onSubmit || quickStrategy.createStrategy;
        if (typeof submitAction === 'function') {
          Promise.resolve(submitAction.call(quickStrategy, mockFormData)).catch(err => {
            console.warn("[ScannerBridge] Store submission caught warning:", err);
          });
        }
      } catch (error) {
        console.warn("[ScannerBridge] Quick strategy store method failed:", error);
      }
    }

    // 2. Helper function to apply field values directly on the blocks
    const applyBlockMutations = () => {
      if (!ScannerBridge.isScannerActive) return;

      try {
        const Blockly = (window as any).Blockly;
        const workspace = Blockly?.mainWorkspace || Blockly?.derivWorkspace;

        if (workspace && typeof workspace.getAllBlocks === 'function') {
          const blocks = workspace.getAllBlocks(false);
          if (Array.isArray(blocks)) {
            let updated = false;

            blocks.forEach((block: any) => {
              if (!block) return;

              // Symbol Update
              if (typeof block.getField === 'function') {
                const symbolField = block.getField('SYMBOL_LIST');
                if (symbolField && symbolField.getValue() !== strictDerivSymbol) {
                  if (symbolField.menuGenerator_ && Array.isArray(symbolField.menuGenerator_)) {
                    const exists = symbolField.menuGenerator_.some((opt: any) => opt[1] === strictDerivSymbol || opt[0] === strictDerivSymbol);
                    if (!exists) {
                      symbolField.menuGenerator_.push([strictDerivSymbol, strictDerivSymbol]);
                    }
                  }
                  symbolField.setValue(strictDerivSymbol);
                  updated = true;
                }
              }

              // Purchase Condition Enforcement
              if (block.type === 'purchase' || block.type?.includes('purchase') || block.type === 'trade_definition_purchase') {
                const fieldNames = ['PURCHASE_LIST', 'PURCHASE_TYPE', 'PURCHASE_CONDITIONS_LIST', 'CONTRACT_TYPE'];
                fieldNames.forEach(name => {
                  const field = block.getField(name);
                  if (field && typeof field.setValue === 'function') {
                    const options = typeof field.getOptions === 'function' ? field.getOptions() : [];
                    const targetMatch = options.find((opt: any) => {
                      const label = String(opt[0] || '').toLowerCase();
                      const val = String(opt[1] || '').toLowerCase();
                      if (isFall) {
                        return label.includes('fall') || label.includes('put') || val.includes('fall') || val.includes('put');
                      } else {
                        return label.includes('rise') || label.includes('call') || val.includes('rise') || val.includes('call');
                      }
                    });

                    const desiredVal = targetMatch ? targetMatch[1] : (isFall ? 'Fall' : 'Rise');
                    if (field.getValue() !== desiredVal) {
                      field.setValue(desiredVal);
                      updated = true;
                    }
                  }
                });
              }

              // Martingale Multiplier Enforcement (2.4)
              if (block.type === 'trade_again' || block.type?.includes('restart') || block.type?.includes('martingale')) {
                block.inputList?.forEach((input: any) => {
                  input.fieldRow?.forEach((field: any) => {
                    if (field && typeof field.setValue === 'function' && (field.name === 'VALUE' || field.name === 'MULTIPLIER' || field.EDITABLE)) {
                      const val = Number(field.getValue());
                      if (val === 3 || isNaN(val) || field.getValue() === '3') {
                        field.setValue(String(martingaleMultiplier));
                        updated = true;
                      }
                    }
                  });
                });
              }
            });

            if (updated && typeof workspace.render === 'function') {
              workspace.render();
            }
          }
        }
      } catch (e) {
        // silent
      }
    };

    // 3. Bind directly to Blockly workspace events post-activation
    try {
      const Blockly = (window as any).Blockly;
      const workspace = Blockly?.mainWorkspace || Blockly?.derivWorkspace;
      
      if (workspace && workspace.addChangeListener) {
        if (ScannerBridge.activeListener) {
          workspace.removeChangeListener(ScannerBridge.activeListener);
        }
        
        ScannerBridge.activeListener = (event: any) => {
          if (!ScannerBridge.isScannerActive) return;
          if (event && (event.type === Blockly.Events.BLOCK_CREATE || event.type === Blockly.Events.FINISHED_LOADING || event.type === Blockly.Events.UI)) {
            applyBlockMutations();
          }
        };
        workspace.addChangeListener(ScannerBridge.activeListener);
      }
    } catch (err) {
      console.warn("[ScannerBridge] Event listener binding warning:", err);
    }

    // 4. Run immediate bursts to apply scanner parameters
    applyBlockMutations();
    setTimeout(applyBlockMutations, 100);
    setTimeout(applyBlockMutations, 300);
    setTimeout(applyBlockMutations, 600);
    setTimeout(applyBlockMutations, 1000);

    return true;
  }

  public static loadStrategyToWorkspace(strategy: any, options: { stake?: number; duration?: number; symbol?: string; contractType?: string; stopLoss?: number; takeProfit?: number; [key: string]: any }) {
    const rawSymbol = 
      options?.symbol || 
      strategy?.market || 
      strategy?.symbol || 
      '1HZ100V'; 

    const strategyDirection = options?.contractType || strategy?.direction || strategy?.tradeType || 'rise';

    const payload: AIScannerPayload = {
      symbol: rawSymbol,
      stake: options?.stake || strategy?.recommendedStake || strategy?.stake || 10,
      duration: options?.duration || strategy?.duration || 5,
      tradeType: strategyDirection,
      durationUnit: options?.durationUnit || 't',
      stopLoss: options?.stopLoss || strategy?.stopLoss || 50,
      takeProfit: options?.takeProfit || strategy?.takeProfit || 100
    };

    return this.injectViaStore(payload);
  }
}

export const scannerBridge = ScannerBridge;
