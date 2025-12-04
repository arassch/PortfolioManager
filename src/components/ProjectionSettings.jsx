import React from 'react';

export function ProjectionSettings({
  projectionYears,
  defaultInvestmentYield,
  taxRate,
  onUpdate
}) {
  const handleChange = (updates) => {
    onUpdate(updates);
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4">Projection Settings</h3>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-purple-200 text-sm mb-2">Projection Years</label>
          <input
            type="number"
            value={projectionYears}
            onChange={(e) => handleChange({ projectionYears: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-purple-200 text-sm mb-2">Default Investment Yield (%)</label>
          <input
            type="number"
            step="0.1"
            value={defaultInvestmentYield}
            onChange={(e) => handleChange({ defaultInvestmentYield: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
          />
        </div>
        <div>
          <label className="block text-purple-200 text-sm mb-2">Tax Rate (%)</label>
          <input
            type="number"
            step="0.1"
            value={taxRate}
            onChange={(e) => handleChange({ taxRate: parseFloat(e.target.value) || 0 })}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
          />
        </div>
      </div>
    </div>
  );
}