import { Strategy } from './strategies';

class ScannerBridgeClass {
  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    console.log(`[AI Scanner] Tick received -> ${assetName}: ${price}`);
  }

  public loadStrategyToWorkspace(strategy: any, options: { stake: number; stopLoss: number; [key: string]: any }) {
    console.log(`[AI Scanner] Loading strategy to workspace:`, strategy, options);
    // Add your blockly / workspace loading logic here
  }
}

// Export both the class (for FloatingAI) and the instance (for App.tsx)
export const ScannerBridge = new ScannerBridgeClass();
export const scannerBridge = ScannerBridge;
