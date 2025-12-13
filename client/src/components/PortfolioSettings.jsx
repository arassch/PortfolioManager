import React, { useEffect, useState } from 'react';
import { CURRENCIES } from '../constants/currencies';

export function PortfolioSettings({
  projectionYears,
  taxRate,
  baseCurrency,
  onUpdate
}) {
  const [yearsInput, setYearsInput] = useState(projectionYears ?? '');
  const [taxInput, setTaxInput] = useState(taxRate ?? '');

  useEffect(() => {
    setYearsInput(projectionYears);
  }, [projectionYears]);

  useEffect(() => {
    setTaxInput(taxRate);
  }, [taxRate]);

  const commitYears = () => {
    const parsed = Math.max(1, parseInt(yearsInput, 10) || 1);
    onUpdate({ projectionYears: parsed });
    setYearsInput(parsed);
  };

  const commitTax = () => {
    const parsed = parseFloat(taxInput);
    const value = Number.isFinite(parsed) ? parsed : 0;
    onUpdate({ taxRate: value });
    setTaxInput(value);
  };

  return (
    <div className="flex flex-col md:flex-row items-start gap-4">
      <div className="flex-1">
        <label className="block text-purple-200 text-sm mb-2">Projection Years</label>
        <input
          type="number"
          value={yearsInput}
          onChange={(e) => setYearsInput(e.target.value)}
          onBlur={commitYears}
          onKeyDown={(e) => e.key === 'Enter' && commitYears()}
          className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
        />
      </div>
      <div className="flex-1">
        <label className="block text-purple-200 text-sm mb-2">Tax Rate (%)</label>
        <input
          type="number"
          step="0.1"
          value={taxInput}
          onChange={(e) => setTaxInput(e.target.value)}
          onBlur={commitTax}
          onKeyDown={(e) => e.key === 'Enter' && commitTax()}
          className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
        />
      </div>
      <div className="flex-1">
        <label className="block text-purple-200 text-sm mb-2">Default Currency</label>
        <select
          value={baseCurrency}
          onChange={(e) => onUpdate({ baseCurrency: e.target.value })}
          className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
        >
          {CURRENCIES.map(curr => (
            <option key={curr} value={curr}>{curr}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
