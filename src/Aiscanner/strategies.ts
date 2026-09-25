/**
 * Simultaneously injects Market Symbol, Stake Amount, Purchase Direction (Rise/Fall),
 * Take Profit, and Stop Loss into the active DBot workspace in a single atomic update.
 */
export function applyStrategyToWorkspace(workspace: any, strategy: StrategyConfig): boolean {
  if (!workspace) return false;

  const symbolMap: Record<string, string> = {
    'Volatility 10': 'R_10',
    'Volatility 25': 'R_25',
    'Volatility 50': 'R_50',
    'Volatility 75': 'R_75',
    'Volatility 100': 'R_100',
    'Volatility 100 (1s)': '1HZ100V',
    'Volatility 25 (1s)': '1HZ25V',
  };

  const symbol = symbolMap[strategy.asset] || '1HZ100V';
  const purchaseType = strategy.direction === 'DOWN' ? 'FALL' : 'RISE';

  try {
    // Disable workspace events during batch injection to prevent intermediate render ticks
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    // 1. Inject Market Symbol
    const marketBlock =
      workspace.getBlockById('trade_definition_market') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_market')[0]);
    if (marketBlock && typeof marketBlock.setFieldValue === 'function') {
      marketBlock.setFieldValue(symbol, 'SYMBOL_LIST');
    }

    // 2. Inject Stake Amount inside Trade Options
    const tradeOptionsBlock =
      workspace.getBlockById('trade_definition_tradeoptions') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_tradeoptions')[0]);
    if (tradeOptionsBlock) {
      const amountInput = tradeOptionsBlock.getInput('AMOUNT');
      if (amountInput && amountInput.connection && amountInput.connection.targetBlock()) {
        const shadowBlock = amountInput.connection.targetBlock();
        if (typeof shadowBlock.setFieldValue === 'function') {
          shadowBlock.setFieldValue(strategy.stake.toString(), 'NUM');
        }
      }
    }

    // 3. Inject Purchase Direction (RISE / FALL)
    const purchaseBlocks = workspace.getBlocksByType ? workspace.getBlocksByType('purchase') : [];
    if (purchaseBlocks.length > 0) {
      purchaseBlocks.forEach((pBlock: any) => {
        if (typeof pBlock.setFieldValue === 'function') {
          pBlock.setFieldValue(purchaseType, 'PURCHASE_LIST');
        }
      });
    } else {
      const purchaseBlock = workspace.getBlockById('purchase_block');
      if (purchaseBlock && typeof purchaseBlock.setFieldValue === 'function') {
        purchaseBlock.setFieldValue(purchaseType, 'PURCHASE_LIST');
      }
    }

    // 4. Inject Variables (Take Profit & Stop Loss)
    const allBlocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    let foundTP = false;
    let foundSL = false;

    allBlocks.forEach((block: any) => {
      if (block.type === 'variables_set') {
        const varId = block.getFieldValue('VAR');
        const varModel = workspace.getVariableById ? workspace.getVariableById(varId) : null;
        const varName = varModel ? varModel.name.toLowerCase() : '';

        const valueInput = block.getInput('VALUE');
        if (valueInput && valueInput.connection && valueInput.connection.targetBlock()) {
          const numBlock = valueInput.connection.targetBlock();

          if (typeof numBlock.setFieldValue === 'function') {
            if (
              varName.includes('profit') ||
              varName.includes('tp') ||
              varName.includes('target') ||
              block.id === 'init_tp'
            ) {
              numBlock.setFieldValue(strategy.takeProfit.toString(), 'NUM');
              foundTP = true;
            } else if (
              varName.includes('loss') ||
              varName.includes('sl') ||
              varName.includes('stop') ||
              block.id === 'init_sl'
            ) {
              numBlock.setFieldValue(strategy.stopLoss.toString(), 'NUM');
              foundSL = true;
            } else if (varName.includes('stake') || block.id === 'init_stake') {
              numBlock.setFieldValue(strategy.stake.toString(), 'NUM');
            }
          }
        }
      }
    });

    // 5. Auto-Create TP & SL Variable Blocks if missing from "Run once at start"
    const initBlock =
      workspace.getBlockById('trade_definition_init') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_init')[0]);

    if (initBlock && (!foundTP || !foundSL)) {
      const injectVariableBlock = (varName: string, val: number) => {
        const variable = workspace.createVariable
          ? workspace.createVariable(varName)
          : workspace.getVariableMap().createVariable(varName);

        const varBlock = workspace.newBlock('variables_set');
        varBlock.setFieldValue(variable.getId(), 'VAR');
        varBlock.initSvg();

        const numBlock = workspace.newBlock('math_number');
        numBlock.setFieldValue(val.toString(), 'NUM');
        numBlock.initSvg();

        varBlock.getInput('VALUE').connection.connect(numBlock.outputConnection);

        const initInput = initBlock.getInput('INITIALIZATION');
        if (initInput && initInput.connection) {
          const target = initInput.connection.targetBlock();
          if (!target) {
            initInput.connection.connect(varBlock.previousConnection);
          } else {
            let lastBlock = target;
            while (lastBlock.nextConnection && lastBlock.nextConnection.targetBlock()) {
              lastBlock = lastBlock.nextConnection.targetBlock();
            }
            if (lastBlock.nextConnection) {
              lastBlock.nextConnection.connect(varBlock.previousConnection);
            }
          }
        }
      };

      if (!foundTP) injectVariableBlock('target_profit', strategy.takeProfit);
      if (!foundSL) injectVariableBlock('stop_loss', strategy.stopLoss);
    }

    // Re-enable workspace events
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(true);
    }

    // Render workspace visually in one single atomic frame
    if (typeof workspace.render === 'function') {
      workspace.render();
    }

    return true;
  } catch (error) {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(true);
    }
    console.error('[Strategies] Failed to inject parameters into workspace:', error);
    return false;
  }
}
