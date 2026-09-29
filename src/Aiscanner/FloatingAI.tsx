// src/Aiscanner/FloatingAI.tsx
import React, { useState, useEffect } from 'react';
import { CORE_7_STRATEGIES, StrategyConfig, evaluateStrategySignal, applyStrategyToWorkspace } from './strategies';
import { scannerBridge } from './scannerBridge';
import './FloatingAI.css';

export const FloatingAI: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [strategies, setStrategies] = useState<StrategyConfig[]>(CORE_7_STRATEGIES);
  const [ticks, setTicks] = useState<Record<string, number[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    scannerBridge.init();
    const unsubscribe = scannerBridge.subscribe(setTicks);
    return unsubscribe;
  }, []);

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
      alert(`Strategy "${strat.name}" loaded successfully! Click the Run button on your bot to start.`);
    } else {
      alert('Blockly workspace not found.');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-full shadow-2xl transition transform hover:scale-105 font-medium text-sm border border-indigo-400/30"
        >
          <span className="w-3 h-3 rounded-full bg-white ai-orb-trigger inline-block"></span>
          AI Market Scanner (7)
        </button>
      )}

      {/* Expanded Modal Panel */}
      {isOpen && (
        <div className="ai-scanner-panel w-[90vw] max-w-xl max-h-[80vh] overflow-y-auto p-5 text-white rounded-2xl shadow-2xl border border-slate-700 bg-slate-900/95 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-800">
            <h2 className="text-base font-bold flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-indigo-500 ai-orb-trigger inline-block"></span>
              AI Multi-Market Scanner
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white text-sm bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-lg transition"
            >
              ✕ Close
            </button>
          </div>

          <div className="space-y-3.5 pr-1">
            {strategies.map(strat => {
              const isEditing = editingId === strat.id;

              return (
                <div key={strat.id} className="ai-strategy-card p-3.5 rounded-xl border border-slate-700/60 bg-slate-800/70">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="font-semibold text-sm">{strat.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${strat.direction === 'UP' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                      {strat.direction || 'HOLD'} ({strat.score || 50}%)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2.5">{strat.asset} — {strat.description}</p>

                  {/* Inline Parameter Editing */}
                  <div className="mb-3 text-xs">
                    {isEditing ? (
                      <div className="bg-slate-900/90 p-2.5 rounded-lg space-y-2 border border-slate-700">
                        <div className="grid grid-cols-3 gap-2">
                          <label className="block text-slate-400">Stake: <input type="number" value={strat.stake} onChange={e => {
                            const val = Number(e.target.value);
                            setStrategies(strategies.map(s => s.id === strat.id ? { ...s, stake: val } : s));
                          }} className="w-full bg-slate-800 p-1 mt-0.5 rounded text-white border border-slate-700 text-center" /></label>
                          <label className="block text-slate-400">Stop Loss: <input type="number" value={strat.stopLoss} onChange={e => {
                            const val = Number(e.target.value);
                            setStrategies(strategies.map(s => s.id === strat.id ? { ...s, stopLoss: val } : s));
                          }} className="w-full bg-slate-800 p-1 mt-0.5 rounded text-white border border-slate-700 text-center" /></label>
                          <label className="block text-slate-400">Take Profit: <input type="number" value={strat.takeProfit} onChange={e => {
                            const val = Number(e.target.value);
                            setStrategies(strategies.map(s => s.id === strat.id ? { ...s, takeProfit: val } : s));
                          }} className="w-full bg-slate-800 p-1 mt-0.5 rounded text-white border border-slate-700 text-center" /></label>
                        </div>
                        <button onClick={() => setEditingId(null)} className="w-full bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded font-medium text-xs transition">Save Parameters</button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center bg-slate-900/50 px-3 py-2 rounded-lg border border-slate-800 text-slate-300">
                        <span>Stake: <b className="text-white">{strat.stake}</b></span>
                        <span>SL: <b className="text-white">{strat.stopLoss}</b></span>
                        <span>TP: <b className="text-white">{strat.takeProfit}</b></span>
                        <button onClick={() => setEditingId(strat.id)} className="text-indigo-400 hover:text-indigo-300 font-medium">Edit</button>
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => handleLoadToBlockly(strat)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded-lg font-medium text-xs transition shadow-md"
                  >
                    Load to Bot Workspace
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
