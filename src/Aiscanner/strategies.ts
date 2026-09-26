// src/Aiscanner/strategies.ts

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
    'Volatility 10 Index': 'R_10',
    'Volatility 25 Index': 'R_25',
    'Volatility 50 Index': 'R_50',
    'Volatility 75 Index': 'R_75',
    'Volatility 100 Index': 'R_100',
    'Volatility 100 (1s) Index': '1HZ100V',
    'Volatility 25 (1s) Index': '1HZ25V',
  };

  const symbol = symbolMap[strategy.asset] || '1HZ100V';
  const purchaseType = strategy.direction === 'DOWN' ? 'FALL' : 'RISE';
  const multiplier = strategy.martingaleMultiplier ?? 2.15;

  try {
    if (typeof workspace.setEnableEvents === 'function') {
      workspace.setEnableEvents(false);
    }

    // -------------------------------------------------------------
    // 1. IN-PLACE UPDATE FOR NON-BLANK BLOCK 1 PARAMS
    // -------------------------------------------------------------
    const marketBlock =
      workspace.getBlockById('trade_definition_market') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition_market')[0]);

    if (marketBlock && typeof marketBlock.setFieldValue === 'function') {
      const is1s = symbol.startsWith('1HZ');
      marketBlock.setFieldValue('synthetic_index', 'MARKET_LIST');
      marketBlock.setFieldValue(is1s ? '1hz_index' : 'random_index', 'SUBMARKET_LIST');
      marketBlock.setFieldValue(symbol, 'SYMBOL_LIST');
    }

    // Update Stake in Submarket Trade Options
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

    // -------------------------------------------------------------
    // 2. HELPER FUNCTIONS FOR VARIABLE & BLOCK CREATION / UPDATE
    // -------------------------------------------------------------
    const getOrCreateVariable = (varName: string) => {
      let variable = workspace.getVariableMap
        ? workspace.getVariableMap().getVariable(varName)
        : null;
      if (!variable && typeof workspace.createVariable === 'function') {
        variable = workspace.createVariable(varName);
      }
      return variable;
    };

    const createAndAttachVarBlock = (varName: string, value: number) => {
      const variable = getOrCreateVariable(varName);
      if (!variable) return null;

      const setVarBlock = workspace.newBlock('variables_set');
      setVarBlock.setFieldValue(variable.getId(), 'VAR');

      const numBlock = workspace.newBlock('math_number');
      numBlock.setFieldValue(value.toString(), 'NUM');

      const valInput = setVarBlock.getInput('VALUE');
      if (valInput && valInput.connection && numBlock.outputConnection) {
        valInput.connection.connect(numBlock.outputConnection);
      }

      if (typeof setVarBlock.initSvg === 'function') setVarBlock.initSvg();
      if (typeof numBlock.initSvg === 'function') numBlock.initSvg();

      return setVarBlock;
    };

    const updateBlockNumberValue = (targetBlock: any, val: number) => {
      if (!targetBlock) return;
      if (targetBlock.type === 'math_number' && typeof targetBlock.setFieldValue === 'function') {
        targetBlock.setFieldValue(val.toString(), 'NUM');
        return;
      }
      const valInput = targetBlock.getInput('VALUE') || targetBlock.getInput('NUM');
      if (valInput && valInput.connection && valInput.connection.targetBlock()) {
        const numBlock = valInput.connection.targetBlock();
        if (typeof numBlock.setFieldValue === 'function') {
          numBlock.setFieldValue(val.toString(), 'NUM');
        }
      }
    };

    // -------------------------------------------------------------
    // 3. SCAN EXISTING VARIABLES & UPDATE PRE-EXISTING BLOCKS
    // -------------------------------------------------------------
    const allBlocks = typeof workspace.getAllBlocks === 'function' ? workspace.getAllBlocks(false) : [];
    let hasTP = false;
    let hasSL = false;
    let hasMultiplier = false;
    let hasStake = false;

    allBlocks.forEach((block: any) => {
      if (block.type === 'variables_set') {
        const varId = block.getFieldValue('VAR');
        const varModel = workspace.getVariableById
          ? workspace.getVariableById(varId)
          : workspace.getVariableMap
          ? workspace.getVariableMap().getVariableById(varId)
          : null;

        const varName = varModel ? varModel.name.toLowerCase() : '';

        if (varName.includes('profit') || varName.includes('tp') || block.id === 'init_tp') {
          updateBlockNumberValue(block, strategy.takeProfit);
          hasTP = true;
        } else if (varName.includes('loss') || varName.includes('sl') || block.id === 'init_sl') {
          updateBlockNumberValue(block, strategy.stopLoss);
          hasSL = true;
        } else if (varName.includes('martingale') || varName.includes('multiplier') || block.id === 'init_multiplier') {
          updateBlockNumberValue(block, multiplier);
          hasMultiplier = true;
        } else if (varName.includes('stake') || block.id === 'init_stake' || block.id === 'reset_stake') {
          updateBlockNumberValue(block, strategy.stake);
          hasStake = true;
        }
      }
    });

    // -------------------------------------------------------------
    // 4. BLOCK 1 (RUN ONCE AT START): POPULATE IF BLANK / MISSING VARS
    // -------------------------------------------------------------
    const rootTradeBlock =
      workspace.getBlockById('trade_definition') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('trade_definition')[0]);

    if (rootTradeBlock) {
      const initInput = rootTradeBlock.getInput('INITIALIZATION');
      if (initInput && initInput.connection) {
        const newTP = !hasTP ? createAndAttachVarBlock('target_profit', strategy.takeProfit) : null;
        const newSL = !hasSL ? createAndAttachVarBlock('stop_loss', strategy.stopLoss) : null;
        const newMult = !hasMultiplier ? createAndAttachVarBlock('martingale_multiplier', multiplier) : null;
        const newStake = !hasStake ? createAndAttachVarBlock('stake', strategy.stake) : null;

        const toAttach = [newStake, newTP, newSL, newMult].filter(Boolean);

        if (toAttach.length > 0) {
          let targetSlot = initInput.connection;
          const existingChild = initInput.connection.targetBlock();

          if (existingChild) {
            let tail = existingChild;
            while (tail.nextConnection && tail.nextConnection.targetBlock()) {
              tail = tail.nextConnection.targetBlock();
            }
            targetSlot = tail.nextConnection;
          }

          toAttach.forEach((b) => {
            if (targetSlot && b) {
              targetSlot.connect(b.previousConnection);
              targetSlot = b.nextConnection;
            }
          });
        }
      }
    }

    // -------------------------------------------------------------
    // 5. UPDATE BLOCK 2 (PURCHASE DIRECTION)
    // -------------------------------------------------------------
    const purchaseBlocks = workspace.getBlocksByType ? workspace.getBlocksByType('purchase') : [];
    purchaseBlocks.forEach((pBlock: any) => {
      if (typeof pBlock.setFieldValue === 'function') {
        pBlock.setFieldValue(purchaseType, 'PURCHASE_LIST');
      }
    });

    // -------------------------------------------------------------
    // 6. BLOCK 4 (RESTART TRADING CONDITIONS): CLEAR & BUILD IF BLANK / JUST TRADE AGAIN
    // -------------------------------------------------------------
    const afterPurchaseBlock =
      workspace.getBlockById('after_purchase') ||
      (workspace.getBlocksByType && workspace.getBlocksByType('after_purchase')[0]);

    if (afterPurchaseBlock) {
      const afterInput = afterPurchaseBlock.getInput('AFTERPURCHASE_STACK');

      if (afterInput && afterInput.connection) {
        const topChild = afterInput.connection.targetBlock();

        // Check if Block 4 is empty OR contains only a standalone 'trade_again' block
        const isBlankOrOnlyTradeAgain = !topChild || (topChild.type === 'trade_again' && !topChild.previousConnection?.targetBlock()?.type?.includes('controls_if'));

        if (isBlankOrOnlyTradeAgain) {
          // Dispose of standalone trade_again block if present so we can rebuild clean
          if (topChild && typeof topChild.dispose === 'function') {
            topChild.dispose(false);
          }

          // Build 'controls_if' condition block
          const controlsIfBlock = workspace.newBlock('controls_if');

          if (typeof controlsIfBlock.mutationToDom === 'function' && typeof controlsIfBlock.domToMutation === 'function') {
            controlsIfBlock.domToMutation((window as any).Blockly.Xml.textToDom('<mutation else="1"></mutation>'));
          }

          // Attach 'contract_check_result = win' to IF0
          const checkWinBlock = workspace.newBlock('contract_check_result');
          if (typeof checkWinBlock.setFieldValue === 'function') {
            checkWinBlock.setFieldValue('win', 'CHECK_RESULT');
          }
          const if0Input = controlsIfBlock.getInput('IF0');
          if (if0Input && if0Input.connection && checkWinBlock.outputConnection) {
            if0Input.connection.connect(checkWinBlock.outputConnection);
          }

          // DO0 (WIN): reset stake to initial stake value
          const winResetStake = createAndAttachVarBlock('stake', strategy.stake);
          const do0Input = controlsIfBlock.getInput('DO0');
          if (do0Input && do0Input.connection && winResetStake) {
            do0Input.connection.connect(winResetStake.previousConnection);
          }

          // ELSE (LOSS): stake = stake * martingale_multiplier
          const stakeVar = getOrCreateVariable('stake');
          const multVar = getOrCreateVariable('martingale_multiplier');

          const lossStakeSet = workspace.newBlock('variables_set');
          if (stakeVar) lossStakeSet.setFieldValue(stakeVar.getId(), 'VAR');

          const mathArith = workspace.newBlock('math_arithmetic');
          if (typeof mathArith.setFieldValue === 'function') {
            mathArith.setFieldValue('MULTIPLY', 'OP');
          }

          const getStakeBlock = workspace.newBlock('variables_get');
          if (stakeVar) getStakeBlock.setFieldValue(stakeVar.getId(), 'VAR');

          const getMultBlock = workspace.newBlock('variables_get');
          if (multVar) getMultBlock.setFieldValue(multVar.getId(), 'VAR');

          mathArith.getInput('A')?.connection?.connect(getStakeBlock.outputConnection);
          mathArith.getInput('B')?.connection?.connect(getMultBlock.outputConnection);
          lossStakeSet.getInput('VALUE')?.connection?.connect(mathArith.outputConnection);

          const elseInput = controlsIfBlock.getInput('ELSE');
          if (elseInput && elseInput.connection) {
            elseInput.connection.connect(lossStakeSet.previousConnection);
          }

          // Initialize graphics for created blocks
          if (typeof controlsIfBlock.initSvg === 'function') controlsIfBlock.initSvg();
          if (typeof checkWinBlock.initSvg === 'function') checkWinBlock.initSvg();
          if (typeof lossStakeSet.initSvg === 'function') lossStakeSet.initSvg();
          if (typeof mathArith.initSvg === 'function') mathArith.initSvg();
          if (typeof getStakeBlock.initSvg === 'function') getStakeBlock.initSvg();
          if (typeof getMultBlock.initSvg === 'function') getMultBlock.initSvg();

          // Connect controls_if block into AFTERPURCHASE_STACK
          afterInput.connection.connect(controlsIfBlock.previousConnection);

          // Create fresh trade_again block and attach directly underneath controls_if
          const tradeAgainBlock = workspace.newBlock('trade_again');
          if (typeof tradeAgainBlock.initSvg === 'function') tradeAgainBlock.initSvg();
          if (controlsIfBlock.nextConnection) {
            controlsIfBlock.nextConnection.connect(tradeAgainBlock.previousConnection);
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
    console.error('[Strategies] Strategy application failed:', error);
    return false;
  }
}
