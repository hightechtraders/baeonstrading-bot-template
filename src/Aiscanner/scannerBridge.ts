import { Strategy } from './strategies';

export class ScannerBridge {
  public static loadStrategyToWorkspace(
    strategy: Strategy, 
    customParams: { stake: number; stopLoss: number; takeProfit: number }
  ) {
    console.log(`Loading strategy: ${strategy.name} for ${strategy.market}`);
    console.log(`Parameters Set -> Stake: ${customParams.stake}, SL: ${customParams.stopLoss}, TP: ${customParams.takeProfit}`);

    // Hook into global bot workspace storage or dispatch custom events recognized by bot-skeleton
    window.dispatchEvent(
      new CustomEvent('AI_STRATEGY_LOADED', {
        detail: {
          strategy,
          params: customParams,
        },
      })
    );
  }
}
