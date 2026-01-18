import React, { useState, useEffect, useRef } from 'react';
import { Bookmark, Calendar } from 'lucide-react';
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
  frequency: 'annual', // 'annual' | 'monthly' | 'one_time' | 'every_x_years'
  intervalYears: 1,
  startDate: '',
  endDate: '',
  amountType: 'fixed',
  toAccountId: ''
};

export function TransferRuleForm({
  rule = null,
  accounts,
  milestones = [],
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
      intervalYears: base.intervalYears || 1,
      direction
    };
  };
  const [formRule, setFormRule] = useState(buildInitial(rule));
  const formRuleRef = useRef(formRule);
  const [applyToAll, setApplyToAll] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);

  useEffect(() => {
    const next = buildInitial(rule);
    setFormRule(next);
    formRuleRef.current = next;
    setApplyToAll(false);
  }, [rule, baseCurrency]);

  const setFormRuleWithRef = (updater) => {
    setFormRule(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      formRuleRef.current = next;
      return next;
    });
  };

  const handleChange = (field, value) => {
    setFormRuleWithRef(prev => {
      // default earnings percentage
      if (field === 'amountType' && value === 'earnings' && (!prev.externalAmount || prev.externalAmount <= 0)) {
        return { ...prev, amountType: value, externalAmount: 100 };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = () => {
    const cleaned = { ...formRuleRef.current };
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
    // Reset dropdown state
    setOpenDropdown(null);
    onSubmit({ ...cleaned, applyToAll });
  };

  const MilestonePicker = ({ onSelect, name }) => {
    const hasMilestones = milestones && milestones.length > 0;
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => hasMilestones && setOpenDropdown(openDropdown === name ? null : name)}
          className="p-2 rounded-md bg-white/10 border border-white/20 text-white hover:bg-white/20 disabled:opacity-50"
          disabled={!hasMilestones}
          title="Pick milestone"
        >
          <Bookmark className="w-4 h-4" />
        </button>
        {openDropdown === name && (
          <div className="absolute z-20 right-0 mt-1 w-48 bg-slate-900 border border-white/20 rounded-lg shadow-lg max-h-56 overflow-auto">
            {milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelect(m);
                  setOpenDropdown(null);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                <div className="font-semibold">{m.label}</div>
                <div className="text-xs text-purple-200">Year {m.year}</div>
              </button>
            ))}
            {milestones.length === 0 && (
              <div className="px-3 py-2 text-sm text-purple-200">No milestones</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const DateWithMilestone = ({ value, milestoneId, onChange, name, onSelectMilestone, onManualChange }) => {
    const displayVal = value || '';
    const milestone = milestones.find((m) => m.id == milestoneId);
    const showMilestone = !!milestone;
    const handleDateChange = (val) => {
      onManualChange?.();
      onChange(val);
    };
    const currentYear = new Date().getFullYear();
    const parseDateParts = (val) => {
      const match = val?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) return { year: '', month: '', day: '' };
      return { year: match[1], month: match[2], day: match[3] };
    };
    const parts = parseDateParts(displayVal);
    const daysInMonth = (year, month) => {
      if (!year || !month) return 31;
      return new Date(Number(year), Number(month), 0).getDate();
    };
    const dayOptions = Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, idx) =>
      String(idx + 1).padStart(2, '0')
    );
    const yearOptions = Array.from({ length: 101 }, (_, idx) => String(currentYear - 50 + idx));
    const monthOptions = Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, '0'));
    const updateDate = (next) => {
      const year = next.year || parts.year;
      const month = next.month || parts.month;
      const day = next.day || parts.day;
      if (!year || !month || !day) {
        handleDateChange('');
        return;
      }
      const maxDay = daysInMonth(year, month);
      const safeDay = Math.min(Number(day), maxDay);
      handleDateChange(`${year}-${month}-${String(safeDay).padStart(2, '0')}`);
    };
    return (
      <div className="relative flex items-center">
        {showMilestone ? (
          <div className="w-full pr-16 pl-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-xs flex items-center justify-between gap-3">
            <span>{milestone.label}</span>
            <button
              type="button"
              onClick={() => onManualChange?.()}
              className="text-purple-200 hover:text-purple-100"
              title="Use a specific date"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-full pr-8 pl-2 py-2 rounded-lg bg-white/5 border border-white/20 text-white text-xs flex gap-0.5">
            <select
              value={parts.month}
              onChange={(e) => updateDate({ month: e.target.value })}
              className="bg-transparent text-white focus:outline-none w-9 text-center appearance-none"
            >
              <option value="">MM</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={parts.day}
              onChange={(e) => updateDate({ day: e.target.value })}
              className="bg-transparent text-white focus:outline-none w-9 text-center appearance-none"
            >
              <option value="">DD</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              value={parts.year}
              onChange={(e) => updateDate({ year: e.target.value })}
              className="bg-transparent text-white focus:outline-none w-12 text-center appearance-none"
            >
              <option value="">YYYY</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
        <div className="absolute right-1 flex items-center gap-1">
          <MilestonePicker
            name={name}
            onSelect={(m) => {
              onSelectMilestone?.(m);
              onChange(`${m.year}-01-01`);
            }}
          />
        </div>
      </div>
    );
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
              {['one_time', ...FREQUENCIES, 'every_x_years'].map(freq => (
                <option key={freq} value={freq}>{freq.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {formRule.frequency === 'every_x_years' && (
              <div className="mt-2">
                <label className="block text-purple-200 text-sm mb-1">Repeat every (years)</label>
                <input
                  type="number"
                  min="1"
                  value={formRule.intervalYears || 1}
                  onChange={(e) => handleChange('intervalYears', Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-32 px-3 py-2 rounded-lg bg-white/5 border border-white/20 text-white focus:outline-none focus:border-purple-400"
                />
              </div>
            )}
          </div>

          {formRule.frequency === 'one_time' ? (
            <div className="space-y-2">
              <label className="block text-purple-200 text-sm mb-1">Date</label>
              <DateWithMilestone
                value={formRule.startDate}
                milestoneId={formRule.startMilestoneId}
                onChange={(v) => handleChange('startDate', v)}
                name="one_time"
                onSelectMilestone={(m) => handleChange('startMilestoneId', m.id)}
                onManualChange={() => handleChange('startMilestoneId', null)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="block text-purple-200 text-sm mb-1">Start Date</label>
                <DateWithMilestone
                  value={formRule.startDate}
                  milestoneId={formRule.startMilestoneId}
                  onChange={(v) => handleChange('startDate', v)}
                  name="start"
                  onSelectMilestone={(m) => handleChange('startMilestoneId', m.id)}
                  onManualChange={() => handleChange('startMilestoneId', null)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-purple-200 text-sm mb-1">End Date (optional)</label>
                <DateWithMilestone
                  value={formRule.endDate}
                  milestoneId={formRule.endMilestoneId}
                  onChange={(v) => handleChange('endDate', v)}
                  name="end"
                  onSelectMilestone={(m) => handleChange('endMilestoneId', m.id)}
                  onManualChange={() => handleChange('endMilestoneId', null)}
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
