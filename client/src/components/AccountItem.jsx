import React, { useState, useEffect } from 'react';
import { Edit2, Save, Trash2 } from 'lucide-react';
import CurrencyService from '../services/CurrencyService';

export function AccountItem({ 
  account, 
  displayBalance,
  isEditing, 
  onStartEdit, 
  onSaveEdit, 
  onSaveProjectionValue,
  onFinishEdit,
  onDelete, 
  onAddActualValue,
  onDeleteActualValue,
  actualValues = {},
  enableProjectionFields = true,
  showReturnRate = true
}) {
  const [dateVal, setDateVal] = useState('');
  const [value, setValue] = useState('');
  const [balanceDraft, setBalanceDraft] = useState(account.balance);
  const [showActualPanel, setShowActualPanel] = useState(false);

  useEffect(() => {
    setBalanceDraft(account.balance);
  }, [account.balance, isEditing]);

  const handleAddActual = () => {
    const actualValue = parseFloat(String(value).replace(/,/g, ''));
    if (!isNaN(actualValue) && dateVal) {
      onAddActualValue(account.id, dateVal, actualValue);
      setDateVal('');
      setValue('');
    }
  };
  const currentYear = new Date().getFullYear();
  const actualEntries = Object.entries(actualValues || {})
    .map(([key, val]) => {
      const keyString = typeof key === 'string'
        ? key
        : key instanceof Date
          ? key.toISOString().slice(0, 10)
          : String(key);
      const match = keyString.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
      const hasDate = !!match;
      const yearValue = hasDate ? Number(match[1]) : Number(key);
      const label = hasDate
        ? `${match[1]}-${match[2]}${match[3] ? `-${match[3]}` : ''}`
        : keyString;
      return { key, value: val, year: Number.isFinite(yearValue) ? yearValue : currentYear, label };
    })
    .sort((a, b) => a.year - b.year || a.label.localeCompare(b.label));

  const returnRate = account.returnRate;
  const rateLabel = account.type === 'cash' ? 'Interest' : 'Return Rate';
  const saveProjection = onSaveProjectionValue || onSaveEdit;
  const canEditRate = isEditing && enableProjectionFields;
  const effectiveTaxTreatment = account.taxTreatment ?? (account.taxable ? 'taxable' : 'roth');
  const taxTreatmentLabel = effectiveTaxTreatment === 'deferred'
    ? 'Taxed (Full)'
    : effectiveTaxTreatment === 'taxable'
      ? 'Taxed (Gains)'
      : 'Tax Free';

  const formatInputNumber = (val) => {
    if (val === '' || val === null || val === undefined) return '';
    const num = Number(String(val).replace(/,/g, ''));
    if (!Number.isFinite(num)) return val;
    return num.toLocaleString();
  };

  const parseNumber = (val) => {
    if (val === '' || val === null || val === undefined) return NaN;
    return Number(String(val).replace(/,/g, ''));
  };

  const persistBalance = async (finish = false) => {
    const num = parseNumber(balanceDraft);
    const finalVal = Number.isFinite(num) ? num : 0;
    await onSaveEdit(account.id, 'balance', finalVal);
    if (finish) {
      onFinishEdit?.();
    }
  };

  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/20 hover:bg-white/10 transition-all">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {isEditing ? (
              <input
                type="text"
                value={account.name}
                onChange={(e) => onSaveEdit(account.id, 'name', e.target.value)}
                className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-lg font-semibold"
              />
            ) : (
              <h4 className="text-lg font-semibold text-white">{account.name}</h4>
            )}
            <span className={`px-2 py-1 rounded text-xs ${
              account.type === 'investment' ? 'bg-blue-500/30 text-blue-200' : 'bg-green-500/30 text-green-200'
            }`}>
              {account.type}
            </span>
            <span className="px-2 py-1 rounded text-xs bg-purple-500/30 text-purple-200">
              {account.currency}
            </span>
            {isEditing ? (
              <label className="flex items-center gap-2 px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-purple-100">
                <span>Tax Treatment</span>
                <select
                  value={effectiveTaxTreatment}
                  onChange={(e) => {
                    const next = e.target.value;
                    onSaveEdit(account.id, 'taxTreatment', next);
                  }}
                  className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white"
                >
                  <option value="taxable">Taxed (Gains)</option>
                  <option value="deferred">Taxed (Full)</option>
                  <option value="roth">Tax Free</option>
                </select>
              </label>
            ) : (
              <span className="px-2 py-1 rounded text-xs bg-orange-500/30 text-orange-200">
                {taxTreatmentLabel}
              </span>
            )}
          </div>
          <div className={`grid gap-4 text-sm ${showReturnRate ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            <div>
              <span className="text-purple-200">Balance: </span>
              {isEditing ? (
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatInputNumber(balanceDraft)}
                  onChange={(e) => setBalanceDraft(e.target.value)}
                  onBlur={() => persistBalance(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      persistBalance(true);
                    }
                  }}
                  className="w-28 px-2 py-1 rounded bg-white/10 border border-white/20 text-white"
                />
              ) : (
                <span className="text-white font-semibold">
                  {CurrencyService.formatCurrency(
                    displayBalance != null ? displayBalance : account.balance,
                    account.currency
                  )}
                </span>
              )}
            </div>
            {showReturnRate && (
              <div>
                <span className="text-purple-200">{rateLabel}: </span>
                {canEditRate ? (
                  <input
                    type="number"
                    step="0.1"
                    value={returnRate}
                    onChange={(e) => saveProjection(
                      account.id,
                      'returnRate',
                      parseFloat(e.target.value) || 0
                    )}
                    className="w-16 px-2 py-1 rounded bg-white/10 border border-white/20 text-white"
                  />
                ) : (
                  <span className="text-white font-semibold">
                    {returnRate}%
                    {isEditing && !enableProjectionFields && (
                      <span className="text-purple-300 text-xs ml-2">(edit in projection tabs)</span>
                    )}
                  </span>
                )}
              </div>
            )}
            <div>
              <button
                onClick={() => setShowActualPanel((prev) => !prev)}
                className="text-sm text-purple-300 hover:text-purple-200 underline"
              >
                {showActualPanel ? 'Hide Actual Values' : 'Show Actual Values'}
              </button>
            </div>
          </div>
          {showActualPanel && actualEntries.length > 0 && (
            <div className="mt-3 text-sm text-purple-100 space-y-1">
              {actualEntries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-2 py-1"
                >
                  <span>{entry.label}: {CurrencyService.formatCurrency(entry.value, account.currency)}</span>
                  <button
                    onClick={() => onDeleteActualValue?.(account.id, entry.key)}
                    className="text-red-300 hover:text-red-200 text-xs underline"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
          {showActualPanel && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  placeholder="Date"
                  value={dateVal}
                  onChange={(e) => setDateVal(e.target.value)}
                  className="px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Actual Value"
                  value={formatInputNumber(value)}
                  onChange={(e) => setValue(e.target.value)}
                  className="flex-1 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                />
                <button
                  onClick={handleAddActual}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <button
              onClick={() => persistBalance(true)}
              className="p-2 text-green-400 hover:text-green-300"
            >
              <Save className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => onStartEdit(account)} className="p-2 text-blue-400 hover:text-blue-300">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(account.id)}
            className="p-2 rounded-lg bg-white/5 border border-white/20 text-red-300 hover:text-red-200 hover:bg-white/10 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
