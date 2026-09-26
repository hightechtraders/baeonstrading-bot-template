// src/Aiscanner/useDerivTicks.ts
import { useState, useEffect } from 'react';
import { scannerBridge } from './scannerBridge';

export const ASSET_TO_SYMBOL: Record<string, string> = {
  'Volatility 10': 'R_10',
  'Volatility 25': 'R_25',
  'Volatility 50': 'R_50',
  'Volatility 75': 'R_75',
  'Volatility 100': 'R_100',
  'Volatility 100 (1s)': '1HZ100V',
  'Volatility 25 (1s)': '1HZ25V',
  'Volatility 10 Index': 'R_10',
  'Volatility 25 Index': 'R_25',
};

export function resolveSymbol(assetName: string): string {
  if (!assetName) return '';
  if (ASSET_TO_SYMBOL[assetName]) return ASSET_TO_SYMBOL[assetName];

  const clean = assetName.trim();
  return ASSET_TO_SYMBOL[clean] || clean;
}

export function useDerivTicks(_assets?: string[]) {
  const [ticksBuffer, setTicksBuffer] = useState<Record<string, number[]>>({});

  useEffect(() => {
    // 1. Initialize WebSocket bridge & automatic tick subscriptions
    scannerBridge.init();

    // 2. Stream tick updates into React component state
    const unsubscribe = scannerBridge.subscribe((buffer) => {
      setTicksBuffer(buffer);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { ticksBuffer };
}
