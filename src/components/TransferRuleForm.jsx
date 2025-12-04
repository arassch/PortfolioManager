import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { FREQUENCIES, AMOUNT_TYPES } from '../constants/currencies';

const DEFAULT_RULE = {
  fromAccountId: '',
  fromExternal: false,
  externalAmount: 0,
  externalCurrency: 'USD',
  frequency: 'annual',
  amountType: 'fixed',
  transfers: [{ toAccountId: '' }]
};

export function TransferRuleForm({
  rule = null,
  accounts,
  onSubmit,
  onCancel,
  baseCurrency = 'USD'
}) {
  const [formRule, setFormRule] = useState(rule || DEFAULT_RULE);

  useEffect(() => {
    if (rule) {
      setFormRule(rule);
    }
  }, [rule]);

  const handleChange = (field, value) => {
    setFormRule(prev => ({ ...prev, [field]: value }));
  };

  const handleTransferChange = (index, field, value) => {
    const updatedTransfers = [...formRule.transfers];
    updatedTransfers[index][field] = value;
    setFormRule(prev => ({ ...prev, transfers: updatedTransfers }));
  };

  const addTransfer = () => {
    setFormRule(prev => ({
      ...prev,
      transfers: [...prev.transfers, { toAccountId: '' }]
    }));
  };

  const removeTransfer = (index) => {
    if (formRule.transfers.length > 1) {
      setFormRule(prev => ({
        ...prev,
        transfers: prev.transfers.filter((_, i) => i !== index)
      }));
    }
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
                  {/* Import CURRENCIES and add this */}
                </select>
              </div>
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
        <label className="block text-purple-200 text-sm">Transfer To (split equally)</label>
        {formRule.transfers.map((transfer, index) => (
          <div key={index} className="flex gap-2 items-center">
            <select
              value={transfer.toAccountId}
              onChange={(e) => handleTransferChange(index, 'toAccountId', e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
            >
              <option value="">Select Account</option>
              {accounts.filter(acc => acc.id !== formRule.fromAccountId).map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
            {formRule.transfers.length > 1 && (
              <button
                onClick={() => removeTransfer(index)}
                className="p-2 text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={addTransfer}
          className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-all"
        >
          + Add Destination
        </button>
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