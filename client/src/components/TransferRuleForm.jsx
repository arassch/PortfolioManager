import React, { useState, useEffect } from 'react';
import { FREQUENCIES, AMOUNT_TYPES, CURRENCIES } from '../constants/currencies';

const DEFAULT_RULE = {
  fromAccountId: '',
  fromExternal: false,
  externalAmount: 0,
  externalCurrency: 'USD',
  frequency: 'annual',
  amountType: 'fixed',
  toAccountId: '',
};

export function TransferRuleForm({
  rule = null,
  accounts,
  onSubmit,
  onCancel,
  baseCurrency = 'USD'
}) {
  const [formRule, setFormRule] = useState(rule ? { ...DEFAULT_RULE, ...rule } : DEFAULT_RULE);

  useEffect(() => {
    if (rule) {
      setFormRule({ ...DEFAULT_RULE, ...rule });
    } else {
      setFormRule(DEFAULT_RULE);
    }
  }, [rule]);

  const handleChange = (field, value) => {
    setFormRule(prev => {
      // If switching to earnings and no percentage set, default to 100%
      if (field === 'amountType' && value === 'earnings' && (!prev.externalAmount || prev.externalAmount <= 0)) {
        return { ...prev, amountType: value, externalAmount: 100 };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = () => {
    onSubmit(formRule);
  };

  return (
    <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/20">
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="flex items-center gap-2 text-white cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={formRule.fromExternal}
              onChange={(e) => handleChange('fromExternal', e.target.checked)}
              className="w-4 h-4 rounded"
            />
            External Source
          </label>

          {formRule.fromExternal ? (
            <div>
              <label className="block text-purple-200 text-sm mb-2">Amount Type</label>
              <select
                value={formRule.amountType}
                onChange={(e) => handleChange('amountType', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400 mb-2"
              >
                {AMOUNT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {formRule.amountType === 'earnings' ? (
                <div>
                  <label className="block text-purple-200 text-sm mb-2">
                    Percentage of earnings to transfer (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formRule.externalAmount || ''}
                    onChange={(e) => handleChange('externalAmount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              ) : (
                <>
                  <label className="block text-purple-200 text-sm mb-2">
                    Amount per {formRule.frequency === 'annual' ? 'Year' : 'Month'}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={formRule.externalAmount || ''}
                      onChange={(e) => handleChange('externalAmount', parseFloat(e.target.value) || 0)}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                    />
                    <select
                      value={formRule.externalCurrency}
                      onChange={(e) => handleChange('externalCurrency', e.target.value)}
                      className="w-24 px-2 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr} value={curr}>{curr}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-purple-200 text-sm mb-2">Transfer From</label>
              <select
                value={formRule.fromAccountId}
                onChange={(e) => handleChange('fromAccountId', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400 mb-2"
              >
                <option value="">Select Account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
              <label className="block text-purple-200 text-sm mb-2">Amount Type</label>
              <select
                value={formRule.amountType}
                onChange={(e) => handleChange('amountType', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              >
                {AMOUNT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {formRule.amountType === 'earnings' ? (
                <div className="mt-2">
                  <label className="block text-purple-200 text-sm mb-2">
                    Percentage of earnings to transfer (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formRule.externalAmount || 100}
                    onChange={(e) => handleChange('externalAmount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              ) : (
                <div className="mt-2">
                  <label className="block text-purple-200 text-sm mb-2">
                    Amount to transfer (in source account currency)
                  </label>
                  <input
                    type="number"
                    value={formRule.externalAmount || ''}
                    onChange={(e) => handleChange('externalAmount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-purple-200 text-sm mb-2">Frequency</label>
          <select
            value={formRule.frequency}
            onChange={(e) => handleChange('frequency', e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
          >
            {FREQUENCIES.map(freq => (
              <option key={freq} value={freq}>{freq}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <label className="block text-purple-200 text-sm">Transfer To</label>
        <select
          value={formRule.toAccountId}
          onChange={(e) => handleChange('toAccountId', e.target.value)}
          className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
        >
          <option value="">Select Account</option>
          {accounts
            .filter(acc => !formRule.fromAccountId || String(acc.id) !== String(formRule.fromAccountId))
            .map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
        >
          Save Rule
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
