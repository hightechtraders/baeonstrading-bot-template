import { Strategy } from './strategies';

class ScannerBridgeClass {
  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    console.log(`[AI Scanner] Tick received -> ${assetName}: ${price}`);
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; takeProfit?: number; [key: string]: any }) {
    console.log(`[AI Scanner] Injecting strategy parameters into Blockly workspace:`, strategy, options);

    // Access the global Blockly instance injected by Deriv / dBot
    const workspace = (window as any).Blockly?.getMainWorkspace?.();
    if (!workspace) {
      console.warn('[AI Scanner] Blockly workspace not found on window object.');
      return;
    }

    // Traverse workspace blocks to find trade parameter inputs (e.g., stake, stop loss, take profit)
    const blocks = workspace.getAllBlocks(false);
    for (const block of blocks) {
      // Look for standard Deriv/dBot block types (like trade definition or purchase blocks)
      if (block.type === 'trade_definition' || block.type === 'trade_definition_stake' || block.type === 'math_number') {
        // Example: Update specific fields if they match trade parameters
        if (options.stake !== undefined && block.getField('STAKE')) {
          block.getField('STAKE').setValue(String(options.stake));
        }
        if (options.stopLoss !== undefined && block.getField('STOP_LOSS')) {
          block.getField('STOP_LOSS').setValue(String(options.stopLoss));
        }
        if (options.takeProfit !== undefined && block.getField('TAKE_PROFIT')) {
          block.getField('TAKE_PROFIT').setValue(String(options.takeProfit));
        }
      }
    }

    // Trigger workspace event notification so Blockly re-renders
    workspace.fireChangeListener(new (window as any).Blockly.Events.BlockChange(
      null, 'edit', '', {}, {}
    ));
  }
}

export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
