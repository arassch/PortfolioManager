import React, { useState, useEffect } from 'react';
import { FREQUENCIES, AMOUNT_TYPES, CURRENCIES } from '../constants/currencies';

const DEFAULT_RULE = {
  fromAccountId: '',
  fromExternal: false,
  toExternal: false,
  external: false,
  direction: 'internal', // 'internal' | 'input' | 'output'
  externalTarget: '',
  externalAmount: 0,
  externalCurrency: null,
  frequency: 'annual', // 'annual' | 'monthly' | 'one_time'
  startDate: '',
  endDate: '',
  amountType: 'fixed',
  toAccountId: ''
};

export function TransferRuleForm({
  rule = null,
  accounts,
  onSubmit,
  onCancel,
  baseCurrency = 'USD',
  isEdit = false
}) {
  const today = new Date().toISOString().slice(0, 10);
  const initialCurrency = rule?.externalCurrency || baseCurrency;
  const normalizeDate = (val) => {
    if (!val) return '';
    return typeof val === 'string' && val.includes('T') ? val.split('T')[0] : val;
  };
  const buildInitial = (incoming) => {
    const base = { ...DEFAULT_RULE, ...incoming };
    // Infer external flag/direction from fromExternal/toExternal if not provided
    let external = base.external;
    let direction = base.direction;
    if (base.fromExternal) {
      external = true;
      direction = 'input';
    } else if (base.toExternal) {
      external = true;
      direction = 'output';
    }
    return {
      ...base,
      startDate: normalizeDate(base.startDate) || today,
      endDate: normalizeDate(base.endDate) || '',
      externalCurrency: base.externalCurrency || baseCurrency,
      external,
      direction
    };
  };
  const [formRule, setFormRule] = useState(buildInitial(rule));
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    setFormRule(buildInitial(rule));
    setApplyToAll(false);
  }, [rule, baseCurrency]);

  const handleChange = (field, value) => {
    setFormRule(prev => {
      // default earnings percentage
      if (field === 'amountType' && value === 'earnings' && (!prev.externalAmount || prev.externalAmount <= 0)) {
        return { ...prev, amountType: value, externalAmount: 100 };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = () => {
    const cleaned = { ...formRule };
    if (!cleaned.external) {
      cleaned.direction = 'internal';
      cleaned.fromExternal = false;
      cleaned.toExternal = false;
      cleaned.externalTarget = '';
    } else if (cleaned.direction === 'input') {
      cleaned.fromExternal = true;
      cleaned.toExternal = false;
    } else if (cleaned.direction === 'output') {
      cleaned.fromExternal = false;
      cleaned.toExternal = true;
    }
    cleaned.externalCurrency = cleaned.externalCurrency || baseCurrency;
    onSubmit({ ...cleaned, applyToAll });
  };

  const renderAmountControls = (disableEarnings) => (
    <>
      <label className="block text-purple-200 text-sm mb-2">Amount Type</label>
      <select
        value={formRule.amountType}
        onChange={(e) => handleChange('amountType', e.target.value)}
        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
        disabled={disableEarnings}
      >
        {AMOUNT_TYPES.map(type => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      {formRule.amountType === 'earnings' && !disableEarnings ? (
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
            Amount
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
        </div>
      )}
    </>
  );

  return (
    <div className="bg-white/5 rounded-lg p-4 mb-4 border border-white/20">
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={formRule.external}
                onChange={(e) => {
                  const external = e.target.checked;
                  handleChange('external', external);
                  if (!external) {
                    handleChange('direction', 'internal');
                    handleChange('fromExternal', false);
                    handleChange('toExternal', false);
                    handleChange('amountType', formRule.amountType || 'fixed');
                  } else {
                    handleChange('direction', 'input');
                    handleChange('fromExternal', true);
                    handleChange('toExternal', false);
                    handleChange('amountType', 'fixed');
                  }
                }}
                className="w-4 h-4 rounded"
              />
              External
            </label>
            {formRule.external && (
              <select
                value={formRule.direction === 'input' ? 'input' : 'output'}
                onChange={(e) => {
                  const dir = e.target.value;
                  handleChange('direction', dir);
                  if (dir === 'input') {
                    handleChange('fromExternal', true);
                    handleChange('toExternal', false);
                    handleChange('amountType', 'fixed');
                  } else {
                    handleChange('fromExternal', false);
                    handleChange('toExternal', true);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white"
              >
                <option value="input">Income</option>
                <option value="output">Outcome</option>
              </select>
            )}
          </div>

          {!formRule.external || formRule.direction === 'output' ? (
            <>
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
              {!formRule.external && (
                <>
                  <label className="block text-purple-200 text-sm mb-2">Transfer To</label>
                  <select
                    value={formRule.toAccountId}
                    onChange={(e) => handleChange('toAccountId', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400 mb-2"
                  >
                    <option value="">Select Account</option>
                    {accounts
                      .filter(acc => !formRule.fromAccountId || String(acc.id) !== String(formRule.fromAccountId))
                      .map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name}</option>
                    ))}
                  </select>
                </>
              )}
              {!formRule.external && renderAmountControls(false)}
            </>
          ) : null}

          {formRule.external && formRule.direction === 'input' ? (
            <>
              <label className="block text-purple-200 text-sm mb-2">Transfer Target</label>
              <select
                value={formRule.toAccountId}
                onChange={(e) => handleChange('toAccountId', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400 mb-2"
              >
                <option value="">Select Account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
              {/* External income: fixed amount only */}
              <div className="mt-2">
                <label className="block text-purple-200 text-sm mb-2">Amount</label>
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
              </div>
              <div className="mt-2">
                <label className="block text-purple-200 text-sm mb-2">External Target (label)</label>
                <input
                  type="text"
                  value={formRule.externalTarget}
                  onChange={(e) => handleChange('externalTarget', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  placeholder="e.g., Paycheck, Vendor"
                />
              </div>
            </>
          ) : null}

          {formRule.external && formRule.direction === 'output' && (
            <>
              {renderAmountControls(false)}
              <div className="mt-2">
                <label className="block text-purple-200 text-sm mb-2">External Target (label)</label>
                <input
                  type="text"
                  value={formRule.externalTarget}
                  onChange={(e) => handleChange('externalTarget', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                  placeholder="e.g., Mortgage, Bills"
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-purple-200 text-sm mb-2">Frequency</label>
            <select
              value={formRule.frequency}
              onChange={(e) => handleChange('frequency', e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
            >
              {['one_time', ...FREQUENCIES].map(freq => (
                <option key={freq} value={freq}>{freq}</option>
              ))}
            </select>
          </div>

          {formRule.frequency === 'one_time' ? (
            <div>
              <label className="block text-purple-200 text-sm mb-2">Date</label>
              <input
                type="date"
                value={formRule.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-purple-200 text-sm mb-2">Start Date</label>
                <input
                  type="date"
                  value={formRule.startDate}
                  onChange={(e) => handleChange('startDate', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="block text-purple-200 text-sm mb-2">End Date (optional)</label>
                <input
                  type="date"
                  value={formRule.endDate}
                  onChange={(e) => handleChange('endDate', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {!isEdit && (
          <label className="flex items-center gap-2 text-white">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            Apply this rule to all projections
          </label>
        )}
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
