import React, { useState, useEffect } from 'react';
import { CORE_7_STRATEGIES, StrategyConfig, evaluateStrategySignal, applyStrategyToWorkspace } from './strategies';
import { scannerBridge } from './scannerBridge';

export const FloatingAI: React.FC = () => {
  const [strategies, setStrategies] = useState<StrategyConfig[]>(CORE_7_STRATEGIES);
  const [ticks, setTicks] = useState<Record<string, number[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    scannerBridge.init();
    const unsubscribe = scannerBridge.subscribe(setTicks);
    return unsubscribe;
  }, []);

  // Update real-time signals based on incoming tick buffers
  useEffect(() => {
    const updated = strategies.map(strat => {
      const assetTicks = ticks[strat.asset] || [];
      const sig = evaluateStrategySignal(strat, assetTicks);
      return { ...strat, ...sig };
    });
    setStrategies(updated);
  }, [ticks]);

  const handleLoadToBlockly = (strat: StrategyConfig) => {
    const Blockly = (window as any).Blockly;
    const workspace = Blockly?.getMainWorkspace?.();
    const success = applyStrategyToWorkspace(workspace, strat);
    
    if (success) {
      alert(`Strategy "${strat.name}" loaded successfully! Click the manual Run button on your bot to start.`);
    } else {
      alert('Blockly workspace not found. Please open the Bot Builder workspace first.');
    }
  };

  return (
    <div className="ai-scanner-panel p-4 bg-slate-900 text-white rounded-xl shadow-2xl max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">AI Multi-Market Scanner (7 Core Strategies)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map(strat => {
          const isEditing = editingId === strat.id;

          return (
            <div key={strat.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold">{strat.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${strat.direction === 'UP' ? 'bg-green-600' : 'bg-red-600'}`}>
                    {strat.direction || 'HOLD'} ({strat.score || 50}%)
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-2">{strat.asset} — {strat.description}</p>
              </div>

              {/* Editable Parameters */}
              <div className="my-3 space-y-2 text-sm">
                {isEditing ? (
                  <div className="bg-slate-900 p-2 rounded space-y-2">
                    <label className="block">Stake: <input type="number" value={strat.stake} onChange={e => {
                      const val = Number(e.target.value);
                      setStrategies(strategies.map(s => s.id === strat.id ? { ...s, stake: val } : s));
                    }} className="w-full bg-slate-800 p-1 rounded text-white" /></label>
                    <label className="block">Stop Loss: <input type="number" value={strat.stopLoss} onChange={e => {
                      const val = Number(e.target.value);
                      setStrategies(strategies.map(s => s.id === strat.id ? { ...s, stopLoss: val } : s));
                    }} className="w-full bg-slate-800 p-1 rounded text-white" /></label>
                    <label className="block">Take Profit: <input type="number" value={strat.takeProfit} onChange={e => {
                      const val = Number(e.target.value);
                      setStrategies(strategies.map(s => s.id === strat.id ? { ...s, takeProfit: val } : s));
                    }} className="w-full bg-slate-800 p-1 rounded text-white" /></label>
                    <button onClick={() => setEditingId(null)} className="w-full bg-blue-600 py-1 rounded text-xs font-semibold">Done</button>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs text-slate-300 bg-slate-900/50 p-2 rounded cursor-pointer" onClick={() => setEditingId(strat.id)}>
                    <span>Stake: <b>{strat.stake}</b></span>
                    <span>SL: <b>{strat.stopLoss}</b></span>
                    <span>TP: <b>{strat.takeProfit}</b></span>
                    <span className="text-blue-400 underline">Edit</span>
                  </div>
                )}
              </div>

              <button 
                onClick={() => handleLoadToBlockly(strat)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded font-semibold text-sm transition"
              >
                Load to Bot Workspace
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
