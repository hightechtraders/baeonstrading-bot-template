import { Strategy } from './strategies';

class ScannerBridgeClass {
  public pushTick(assetName: string, price: number, strategies: Strategy[]) {
    // Process incoming tick data and evaluate against strategies
    console.log(`Processing tick for ${assetName}: ${price}`);
  }
}

export const scannerBridge = new ScannerBridgeClass();
