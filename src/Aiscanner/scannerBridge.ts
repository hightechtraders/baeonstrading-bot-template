import { Strategy } from './strategies';

class ScannerBridgeClass {
  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    // Process incoming tick data and forward to the scanner store/logic
    console.log(`[AI Scanner] Tick received -> ${assetName}: ${price}`);
  }
}

export const scannerBridge = new ScannerBridgeClass();
