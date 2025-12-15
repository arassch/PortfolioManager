import React, { useState } from 'react';
import { Edit2, Save, Trash2 } from 'lucide-react';
import CurrencyService from '../services/CurrencyService';

export function AccountItem({ 
  account, 
  isEditing, 
  onStartEdit, 
  onSaveEdit, 
  onSaveProjectionValue,
  onFinishEdit,
  onDelete, 
  onAddActualValue,
  onDeleteActualValue,
  actualValues = {},
  showActualValueInput,
  onToggleActualValueInput,
  enableProjectionFields = true,
  showReturnRate = true
}) {
  const [year, setYear] = useState('');
  const [value, setValue] = useState('');

  const handleAddActual = () => {
    const yearInt = parseInt(year, 10);
    const actualValue = parseFloat(value);
    if (!isNaN(yearInt) && !isNaN(actualValue)) {
      onAddActualValue(account.id, yearInt, actualValue);
      setYear('');
      setValue('');
      onToggleActualValueInput?.();
    }
  };
  const currentYear = new Date().getFullYear();
  const actualEntries = Object.entries(actualValues || {})
    .map(([key, val]) => {
      const numKey = Number(key);
      const yearValue = numKey >= 1900 ? numKey : currentYear + numKey; // support legacy offsets
      return { key: numKey, value: val, year: yearValue };
    })
    .sort((a, b) => a.year - b.year);

  const returnRate = account.returnRate;
  const rateLabel = account.type === 'cash' ? 'Interest' : 'Return Rate';
  const saveProjection = onSaveProjectionValue || onSaveEdit;
  const canEditRate = isEditing && enableProjectionFields;

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
            {account.taxable && (
              <span className="px-2 py-1 rounded text-xs bg-orange-500/30 text-orange-200">
                Taxable
              </span>
            )}
          </div>
          <div className={`grid gap-4 text-sm ${showReturnRate ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            <div>
              <span className="text-purple-200">Balance: </span>
              {isEditing ? (
                <input
                  type="number"
                  value={account.balance}
                  onChange={(e) => onSaveEdit(account.id, 'balance', parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-white"
                />
              ) : (
                <span className="text-white font-semibold">
                  {CurrencyService.formatCurrency(account.balance, account.currency)}
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
                onClick={() => onToggleActualValueInput?.()}
                className="text-sm text-purple-300 hover:text-purple-200 underline"
              >
                Edit Actual Values
              </button>
            </div>
          </div>
          {showActualValueInput && (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-20 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
                />
                <input
                  type="number"
                  placeholder="Actual Value"
                  value={value}
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
              {actualEntries.length > 0 && (
                <div className="text-sm text-purple-100 space-y-1">
                  {actualEntries.map((entry) => (
                    <div key={entry.year} className="flex items-center justify-between bg-white/5 border border-white/10 rounded px-2 py-1">
                      <span>{entry.year}: {CurrencyService.formatCurrency(entry.value, account.currency)}</span>
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
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <button onClick={onFinishEdit} className="p-2 text-green-400 hover:text-green-300">
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
