import React, { useState } from 'react';
import { CURRENCIES, ACCOUNT_TYPES } from '../constants/currencies';

export function AccountForm({ baseCurrency, onSubmit, onCancel, initialData = null, allowReturnRateEdit = true }) {
  const [account, setAccount] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        taxTreatment: initialData.taxTreatment ?? (initialData.taxable ? 'taxable' : 'roth')
      };
    }
    return {
      name: '',
      type: 'investment',
      balance: '',
      currency: baseCurrency,
      returnRate: '',
      taxTreatment: 'roth'
    };
  });

  const [errors, setErrors] = useState([]);

  const handleChange = (field, value) => {
    setAccount(prev => ({ ...prev, [field]: value }));
    setErrors([]); // Clear errors on change
  };

  // Parse currency input: removes commas, currency symbols, and extracts number
  const parseCurrencyInput = (input) => {
    // Remove currency symbols and commas, keep only digits and decimal point
    const cleaned = String(input)
      .replace(/[£€¥$C$A$Fr]/g, '') // Remove common currency symbols
      .replace(/[^0-9.]/g, '')      // Keep only numbers and decimal
      .trim();
    
    return parseFloat(cleaned) || 0;
  };

  const validateForm = () => {
    const newErrors = [];
    
    if (!account.name || account.name.trim() === '') {
      newErrors.push('Account name is required');
    }
    
    const balanceNum = parseCurrencyInput(account.balance);
    if (account.balance === '' || isNaN(balanceNum)) {
      newErrors.push('Balance must be a valid number');
    }
    if (balanceNum < 0) {
      newErrors.push('Balance cannot be negative');
    }
    
    if (!account.currency) {
      newErrors.push('Currency is required');
    }
    
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // Parse and convert balance to number before submitting
      onSubmit({
        ...account,
        balance: parseCurrencyInput(account.balance),
        returnRate: parseFloat(account.returnRate) || 0
      });
    }
  };

  return (
    <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/20">
      {errors.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
          {errors.map((error, idx) => (
            <p key={idx} className="text-red-300 text-sm">{error}</p>
          ))}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <input
          type="text"
          placeholder="Account Name"
          value={account.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
        />
        <select
          value={account.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
        >
          {ACCOUNT_TYPES.map(type => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g., 142,263.95 or £142,263.95"
            value={account.balance}
            onChange={(e) => handleChange('balance', e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400"
          />
          <select
            value={account.currency}
            onChange={(e) => handleChange('currency', e.target.value)}
            className="w-24 px-2 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
          >
            {CURRENCIES.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))}
          </select>
        </div>
        {account.type === 'cash' ? (
          <input
            type="number"
            step="0.1"
            placeholder="Interest Rate (%)"
            value={account.returnRate || ''}
            onChange={(e) => allowReturnRateEdit && handleChange('returnRate', e.target.value)}
            disabled={!allowReturnRateEdit}
            title={!allowReturnRateEdit ? 'Edit return rate inside projections' : undefined}
            className={`px-4 py-2 rounded-lg border text-white placeholder-white/50 focus:outline-none focus:border-purple-400 ${
              allowReturnRateEdit ? 'bg-white/5 border-white/20' : 'bg-white/10 border-white/10 cursor-not-allowed opacity-70'
            }`}
          />
        ) : (
          <input
            type="number"
            step="0.1"
            placeholder="Expected Annual Return (%)"
            value={account.returnRate || ''}
            onChange={(e) => allowReturnRateEdit && handleChange('returnRate', e.target.value)}
            disabled={!allowReturnRateEdit}
            title={!allowReturnRateEdit ? 'Edit return rate inside projections' : undefined}
            className={`px-4 py-2 rounded-lg border text-white placeholder-white/50 focus:outline-none focus:border-purple-400 ${
              allowReturnRateEdit ? 'bg-white/5 border-white/20' : 'bg-white/10 border-white/10 cursor-not-allowed opacity-70'
            }`}
          />
        )}
      </div>
      {!allowReturnRateEdit && (
        <p className="text-xs text-purple-200/80 mb-2">Return rate can be edited per projection in the Projections view.</p>
      )}
      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-white">
          <span>Tax Treatment</span>
          <select
            value={account.taxTreatment || 'roth'}
            onChange={(e) => {
              const next = e.target.value;
              handleChange('taxTreatment', next);
            }}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
          >
            <option value="taxable">Taxed (Gains)</option>
            <option value="deferred">Taxed (Full)</option>
            <option value="roth">Tax Free</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
        >
          {initialData ? 'Save Changes' : 'Add Account'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
