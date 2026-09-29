import { Strategy, INITIAL_STRATEGIES } from './strategies';

export class ScannerLogic {
  private strategies: Strategy[] = INITIAL_STRATEGIES;

  public runScan(): Strategy[] {
    // Simulate live fluctuation or processing of market streams
    this.strategies = this.strategies.map((strat) => {
      const randomJitter = Math.floor(Math.random() * 7) - 3; // -3 to +3
      const newConfidence = Math.min(99, Math.max(60, strat.confidence + randomJitter));
      return { ...strat, confidence: newConfidence };
    });

    // Sort descending by highest confidence score
    return [...this.strategies].sort((a, b) => b.confidence - a.confidence);
  }
}
