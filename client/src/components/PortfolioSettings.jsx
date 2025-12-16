import React, { useEffect, useState } from 'react';
import { CURRENCIES } from '../constants/currencies';
import CurrencyService from '../services/CurrencyService';

export function PortfolioSettings({
  projectionYears,
  taxRate,
  baseCurrency,
  fiMode = 'annual_expenses',
  fiMultiplier = 25,
  fiAnnualExpenses = 0,
  fiMonthlyExpenses = 0,
  fiValue = 0,
  onUpdate
}) {
  const [yearsInput, setYearsInput] = useState(projectionYears ?? '');
  const [taxInput, setTaxInput] = useState(taxRate ?? '');
  const [mode, setMode] = useState(fiMode || 'annual_expenses');
  const [multiplierInput, setMultiplierInput] = useState(fiMultiplier ?? 25);
  const [annualInput, setAnnualInput] = useState(fiAnnualExpenses ?? 0);
  const [monthlyInput, setMonthlyInput] = useState(fiMonthlyExpenses ?? 0);
  const [valueInput, setValueInput] = useState(fiValue ?? 0);

  useEffect(() => {
    setYearsInput(projectionYears);
  }, [projectionYears]);

  useEffect(() => {
    setTaxInput(taxRate);
  }, [taxRate]);

  useEffect(() => {
    setMode(fiMode || 'annual_expenses');
    setMultiplierInput(fiMultiplier ?? 25);
    setAnnualInput(fiAnnualExpenses ?? 0);
    setMonthlyInput(fiMonthlyExpenses ?? 0);
    setValueInput(fiValue ?? 0);
  }, [fiMode, fiMultiplier, fiAnnualExpenses, fiMonthlyExpenses, fiValue]);

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

  const commitFi = (overrides = {}) => {
    const payload = {
      fiMode: overrides.mode ?? mode,
      fiMultiplier: Number.isFinite(parseFloat(multiplierInput)) ? parseFloat(multiplierInput) : 25,
      fiAnnualExpenses: Number.isFinite(parseFloat(annualInput)) ? parseFloat(annualInput) : 0,
      fiMonthlyExpenses: Number.isFinite(parseFloat(monthlyInput)) ? parseFloat(monthlyInput) : 0,
      fiValue: Number.isFinite(parseFloat(valueInput)) ? parseFloat(valueInput) : 0
    };
    // If the user changed mode, respect updated draft values
    if (overrides.annualInput !== undefined) payload.fiAnnualExpenses = overrides.annualInput;
    if (overrides.monthlyInput !== undefined) payload.fiMonthlyExpenses = overrides.monthlyInput;
    if (overrides.valueInput !== undefined) payload.fiValue = overrides.valueInput;
    if (overrides.multiplierInput !== undefined) payload.fiMultiplier = overrides.multiplierInput;

    onUpdate(payload);
  };

  const fiTarget = (() => {
    const mult = Number.isFinite(parseFloat(multiplierInput)) ? parseFloat(multiplierInput) : 25;
    if (mode === 'value') return Number(valueInput) || 0;
    if (mode === 'monthly_expenses') return (Number(monthlyInput) || 0) * 12 * mult;
    return (Number(annualInput) || 0) * mult;
  })();

  return (
    <div className="space-y-4">
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

      <div className="bg-white/5 border border-white/15 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="text-white font-semibold">Financial Independence Target</h4>
            <p className="text-purple-200 text-sm">Set FI by target value or expenses × multiplier.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-purple-200">FI Target</p>
            <p className="text-lg font-bold text-white">
              {fiTarget ? CurrencyService.formatCurrency(fiTarget, baseCurrency) : '—'}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-purple-200 text-sm mb-1">Mode</label>
            <select
              value={mode}
              onChange={(e) => {
                const nextMode = e.target.value;
                setMode(nextMode);
                commitFi({ mode: nextMode });
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-purple-400"
            >
              <option value="annual_expenses">Annual × Multiplier</option>
              <option value="monthly_expenses">Monthly × Multiplier</option>
              <option value="value">Direct Target</option>
            </select>
          </div>

          <div>
            <label className="block text-purple-200 text-sm mb-1">
              {mode === 'monthly_expenses' ? 'Monthly Expenses' : mode === 'value' ? 'FI Target Value' : 'Annual Expenses'}
            </label>
            <input
              type="number"
              value={
                mode === 'monthly_expenses'
                  ? monthlyInput
                  : mode === 'value'
                    ? valueInput
                    : annualInput
              }
              onChange={(e) => {
                const val = e.target.value;
                if (mode === 'monthly_expenses') {
                  setMonthlyInput(val);
                } else if (mode === 'value') {
                  setValueInput(val);
                } else {
                  setAnnualInput(val);
                }
              }}
              onBlur={() => {
                if (mode === 'monthly_expenses') {
                  commitFi({ monthlyInput: Number(monthlyInput) || 0 });
                } else if (mode === 'value') {
                  commitFi({ valueInput: Number(valueInput) || 0 });
                } else {
                  commitFi({ annualInput: Number(annualInput) || 0 });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (mode === 'monthly_expenses') {
                    commitFi({ monthlyInput: Number(monthlyInput) || 0 });
                  } else if (mode === 'value') {
                    commitFi({ valueInput: Number(valueInput) || 0 });
                  } else {
                    commitFi({ annualInput: Number(annualInput) || 0 });
                  }
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-purple-400"
            />
          </div>

          {mode !== 'value' ? (
            <div>
              <label className="block text-purple-200 text-sm mb-1">Anual Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={multiplierInput}
                onChange={(e) => setMultiplierInput(e.target.value)}
                onBlur={() => commitFi({ multiplierInput: Number(multiplierInput) || 0 })}
                onKeyDown={(e) => e.key === 'Enter' && commitFi({ multiplierInput: Number(multiplierInput) || 0 })}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              />
            </div>
          ) : (
            <div className="hidden md:block" />
          )}

          <div>
            <label className="block text-purple-200 text-sm mb-1">Calculated FI Target</label>
            <input
              type="text"
              readOnly
              value={fiTarget ? CurrencyService.formatCurrency(fiTarget, baseCurrency) : '—'}
              className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white opacity-80"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
