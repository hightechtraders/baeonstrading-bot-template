import { Strategy } from './strategies';

class ScannerBridgeClass {
  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    console.log(`[AI Scanner] Tick received -> ${assetName}: ${price}`);
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; takeProfit?: number; [key: string]: any }) {
    console.log(`[AI Scanner] Injecting parameters into workspace:`, strategy, options);

    const globalWin = window as any;
    globalWin.tredapendingParams = { ...options, strategy };

    let workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();

    setTimeout(() => {
      workspace = globalWin.Blockly?.derivWorkspace || globalWin.Blockly?.getMainWorkspace?.();
      if (!workspace) return;

      try {
        const allBlocks = workspace.getAllBlocks(false);
        let blockInjectionCounter = 0;

        allBlocks.forEach((block: any) => {
          if (block.type === 'trade_definition') {
            // Prepopulate existing blocks safely without clearing workspace
            const symbolField = block.getField('SYMBOL_LIST');
            if (symbolField && options.symbol) {
              symbolField.setValue(options.symbol);
              blockInjectionCounter++;
            }
          }
          // Match amount/stake or risk parameters on existing blocks
          if (block.type === 'trade_definition_tradeoptions' || block.type.includes('amount') || block.type.includes('stake')) {
            const numField = block.getField('AMOUNT') || block.getField('VALUE') || block.getField('NUM');
            if (numField && options.stake !== undefined) {
              numField.setValue(String(options.stake));
              blockInjectionCounter++;
            }
          }
        });

        if (blockInjectionCounter > 0) {
          workspace.fireChangeListener(new globalWin.Blockly.Events.BlockChange(
            null, 'edit', '', {}, {}
          ));
          console.log(`[AI Scanner] Successfully prepopulated ${blockInjectionCounter} existing blocks.`);
        }
      } catch (err) {
        console.error('[AI Scanner] Error injecting block parameters:', err);
      }
    }, 300);
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
