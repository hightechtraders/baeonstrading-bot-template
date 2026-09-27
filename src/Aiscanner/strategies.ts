// src/Aiscanner/strategies.ts

export type PriorityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface StrategyConfig {
  id: string;
  name: string;
  asset: string;
  tradeType: string;
  riskModel: string;
  priority: PriorityLevel;
  stake: number;
  stopLoss: number;
  takeProfit: number;
  martingaleMultiplier: number;
  description: string;
  score?: number;
  confidence?: number;
  direction?: 'UP' | 'DOWN' | 'HOLD';
}

export interface StrategySignal {
  strategyId: string;
  direction: 'UP' | 'DOWN' | 'HOLD';
  confidence: number;
  score: number;
  timestamp: number;
}

export const CORE_7_STRATEGIES: StrategyConfig[] = [
  {
    id: 'strat-1',
    name: '#1 AI Adaptive',
    asset: 'Volatility 25',
    tradeType: 'Rise / Fall',
    riskModel: 'NEURAL_FLOW',
    priority: 'HIGH',
    stake: 3,
    stopLoss: 4,
    takeProfit: 8,
    martingaleMultiplier: 2.0,
    description: 'Neural Flow structural strategy designed for Volatility 25.',
  },
  {
    id: 'strat-2',
    name: '#2 1-3-2-6 System',
    asset: 'Volatility 10',
    tradeType: 'Rise / Fall',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 2,
    stopLoss: 5,
    takeProfit: 10,
    martingaleMultiplier: 2.0,
    description: 'Progressive staking system designed for Volatility 10.',
  },
  {
    id: 'strat-3',
    name: '#3 Hyper Scalper Engine v26',
    asset: 'Volatility 10',
    tradeType: 'Rise / Fall',
    riskModel: 'MARTINGALE',
    priority: 'MEDIUM',
    stake: 1,
    stopLoss: 10,
    takeProfit: 15,
    martingaleMultiplier: 2.1,
    description: 'Martingale scalp strategy designed for Volatility 10.',
  },
  {
    id: 'strat-4',
    name: '#4 AI Balanced',
    asset: 'Volatility 50',
    tradeType: 'Over / Under',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 5,
    stopLoss: 10,
    takeProfit: 20,
    martingaleMultiplier: 2.0,
    description: 'Balanced digit strategy designed for Volatility 50.',
  },
  {
    id: 'strat-5',
    name: '#5 Momentum Breakout',
    asset: 'Volatility 75',
    tradeType: 'Rise / Fall',
    riskModel: 'TICK_MOMENTUM',
    priority: 'MEDIUM',
    stake: 2,
    stopLoss: 6,
    takeProfit: 12,
    martingaleMultiplier: 2.0,
    description: 'Breakout tick strategy designed for Volatility 75.',
  },
  {
    id: 'strat-6',
    name: '#6 High-Frequency Scalp',
    asset: 'Volatility 100 (1s)',
    tradeType: 'Rise / Fall',
    riskModel: 'NEURAL_FLOW',
    priority: 'MEDIUM',
    stake: 4,
    stopLoss: 8,
    takeProfit: 16,
    martingaleMultiplier: 2.0,
    description: 'Fast-cycle neural model designed for Volatility 100 (1s).',
  },
  {
    id: 'strat-7',
    name: '#7 Conservative Grid',
    asset: 'Volatility 100',
    tradeType: 'Over / Under',
    riskModel: 'PROGRESSIVE',
    priority: 'MEDIUM',
    stake: 1,
    stopLoss: 3,
    takeProfit: 6,
    martingaleMultiplier: 1.5,
    description: 'Low-risk step model designed for Volatility 100.',
  },
];

export function enforceSingleHighPriority(
  strategies: StrategyConfig[],
  highStrategyId?: string
): StrategyConfig[] {
  const targetId = highStrategyId || strategies[0]?.id;

  return strategies.map((strat) => ({
    ...strat,
    priority: strat.id === targetId ? 'HIGH' : 'MEDIUM',
  }));
}

export function evaluateStrategySignal(
  strategy: StrategyConfig,
  ticks: number[]
): { direction: 'UP' | 'DOWN' | 'HOLD'; confidence: number; score: number } {
  if (!ticks || ticks.length < 5) {
    return { direction: 'HOLD', confidence: 50, score: 50 };
  }

  let gains = 0;
  for (let i = 1; i < ticks.length; i++) {
    if (ticks[i] > ticks[i - 1]) gains++;
  }
  const totalSteps = ticks.length - 1;
  const gainRatio = totalSteps > 0 ? gains / totalSteps : 0.5;

  let rawScore = gainRatio * 100;

  const t1 = ticks[ticks.length - 1];
  const t2 = ticks[ticks.length - 2];
  const t3 = ticks[ticks.length - 3];

  if (t1 > t2 && t2 > t3) {
    rawScore += 8;
  } else if (t1 < t2 && t2 < t3) {
    rawScore -= 8;
  }

  const score = Math.max(10, Math.min(98, Math.round(rawScore)));

  let direction: 'UP' | 'DOWN' | 'HOLD' = 'HOLD';
  if (score >= 54) {
    direction = 'UP';
  } else if (score <= 46) {
    direction = 'DOWN';
  }

  const confidence = Math.max(score, 100 - score);

  return { direction, confidence, score };
}

/**
 * Leaves existing canvas dropdowns untouched and builds ONLY the 
 * "Run once at start" initialization stack (Target Profit, Stop Loss, Martingale Size).
 */
export function applyStrategyToWorkspace(workspace: any, strategy: StrategyConfig): boolean {
  if (!workspace) return false;

  const multiplierVal = strategy.martingaleMultiplier ?? 2.0;

  try {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    const rootTradeBlock =
      workspace.getBlockById('trade_definition') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition')[0]);

    if (rootTradeBlock) {
      const initInput = rootTradeBlock.getInput('INITIALIZATION');
      if (initInput) {
        // 1. Clear whatever is currently inside "Run once at start"
        let existingChild = initInput.connection.targetBlock();
        while (existingChild) {
          const nextChild = existingChild.nextConnection && existingChild.nextConnection.targetBlock();
          if (typeof existingChild.dispose === 'function') {
            existingChild.dispose(true);
          }
          existingChild = nextChild;
        }

        // 2. Helper to get or create workspace variables safely
        const getOrCreateVar = (name: string) => {
          let variable = workspace.getVariableMap ? workspace.getVariableMap().getVariable(name) : null;
          if (!variable && typeof workspace.createVariable === 'function') {
            variable = workspace.createVariable(name);
          }
          return variable;
        };

        const vTp = getOrCreateVar('target_profit');
        const vSl = getOrCreateVar('stop_loss');
        const vMult = getOrCreateVar('martingale_size');

        // 3. Build XML strictly for the three "Run once at start" variable blocks
        const buildVarSetXml = (varObj: any, varName: string, val: number) => {
          const varId = varObj ? (varObj.getId ? varObj.getId() : varObj.id_) : varName;
          return `
            <block type="variables_set">
              <field name="VAR" id="${varId}" variabletype="">${varName}</field>
              <value name="VALUE">
                <block type="math_number">
                  <field name="NUM">${val}</field>
                </block>
              </value>
            </block>
          `.trim();
        };

        const parser = new DOMParser();
        const createBlockFromXml = (xmlStr: string) => {
          const doc = parser.parseFromString(xmlStr, 'text/xml');
          if (window.Blockly && window.Blockly.Xml && typeof window.Blockly.Xml.domToBlock === 'function') {
            return window.Blockly.Xml.domToBlock(doc.documentElement, workspace);
          }
          return null;
        };

        const tpBlock = createBlockFromXml(buildVarSetXml(vTp, 'target_profit', strategy.takeProfit));
        const slBlock = createBlockFromXml(buildVarSetXml(vSl, 'stop_loss', strategy.stopLoss));
        const multBlock = createBlockFromXml(buildVarSetXml(vMult, 'martingale_size', multiplierVal));

        const blocks = [tpBlock, slBlock, multBlock].filter(Boolean);

        // 4. Chain them into the "Run once at start" socket
        let currentConnection = initInput.connection;
        for (const block of blocks) {
          if (block && currentConnection) {
            if (typeof block.initSvg === 'function') block.initSvg();
            if (block.previousConnection) {
              currentConnection.connect(block.previousConnection);
              currentConnection = block.nextConnection;
            }
          }
        }
      }
    }

    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(true);
    }
    if (typeof workspace.render === 'function') {
      workspace.render();
    }

    return true;
  } catch (error) {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(true);
    }
    console.error('[Strategies] Failed to build run-once variables:', error);
    return false;
  }
}
