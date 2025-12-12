import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Filter } from 'lucide-react';
import CurrencyService from '../services/CurrencyService';
import { getColorForIndex } from '../utils/helpers';

export function ChartSection({
  projectionData,
  accounts,
  selectedAccounts,
  showIndividualAccounts,
  activeTab,
  baseCurrency,
  defaultInvestmentYield,
  taxRate,
  onTabChange,
  onToggleAccount,
  onToggleIndividualAccounts
}) {
  const formatCurrency = (value) => CurrencyService.formatCurrency(value, baseCurrency);
  const currentYear = new Date().getFullYear();

  const getDefaultHover = () => {
    if (!projectionData || projectionData.length === 0) return null;
    const current = projectionData.find(p => p.year === currentYear);
    return current || projectionData[0];
  };

  const [hoverData, setHoverData] = useState(getDefaultHover());

  useEffect(() => {
    setHoverData(getDefaultHover());
  }, [projectionData]);
  const accountMap = accounts.reduce((map, acc) => {
    map[acc.id] = acc;
    return map;
  }, {});

  const buildAccountBreakdown = (current, prev) => {
    return accounts
      .filter((acc) => selectedAccounts[acc.id])
      .map((acc) => {
        const rate =
          (typeof acc.getYieldRate === 'function' ? acc.getYieldRate() : null) ??
          acc.interestRate ??
          acc.yield ??
          defaultInvestmentYield;

        const prevVal = prev ? prev[`account_${acc.id}`] : null;
        const currVal = current ? current[`account_${acc.id}`] : null;
        const isTaxable = !!acc.taxable;
        const currNet = isTaxable && current ? current[`account_${acc.id}_net`] : null;
        if (prevVal == null || currVal == null) return null;

        const gross = prevVal * (1 + rate / 100);
        const transferNet = current[`account_${acc.id}_transfers`] || 0;
        const calcParts = [
          `prev ${formatCurrency(prevVal)}`,
          `x ${rate}%`,
          transferNet ? `${transferNet > 0 ? '+ transfers ' : '- transfers '}${formatCurrency(Math.abs(transferNet))}` : null,
          `= ${formatCurrency(currVal)}`
        ].filter(Boolean);
        const calc = calcParts.join(' ');
        const estTax = isTaxable && currNet != null ? Math.max(currVal - currNet, 0) : null;

        return {
          name: acc.name,
          current: currVal,
          net: currNet,
          estTax,
          calc
        };
      })
      .filter(Boolean);
  };

  const renderGrowthTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const current = payload[0].payload;
    const idx = projectionData.findIndex((p) => p.label === label);
    const prev = idx > 0 ? projectionData[idx - 1] : null;
    const prevValue = prev?.projected ?? 0;
    const delta = current.projected - prevValue;
    const pct = prevValue ? `${((delta / prevValue) * 100).toFixed(1)}%` : 'n/a';

    return (
      <div className="rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg">
        <div className="font-semibold">{label}</div>
        <div className="mt-1 space-y-1">
          <div>Projected: {formatCurrency(current.projected)}</div>
          {prev && (
            <div className="text-xs text-purple-200">
              Prev: {formatCurrency(prevValue)} | Δ {formatCurrency(delta)} ({pct})
            </div>
          )}
          {current.actual ? (
            <div className="text-green-300">Actual: {formatCurrency(current.actual)}</div>
          ) : null}
          {showIndividualAccounts && (
            <div className="pt-1 text-xs text-slate-200 space-y-1">
              {buildAccountBreakdown(current, prev).map((item) => (
                <div key={item.name}>
                  <span className="font-semibold">{item.name}:</span> {formatCurrency(item.current)} ({item.calc})
                  {item.net != null && (
                    <div className="text-[11px] text-emerald-200">
                      After-tax est: {formatCurrency(item.net)}{item.estTax != null ? ` (Est tax: ${formatCurrency(item.estTax)})` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEarningsTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const current = payload[0].payload;
    const idx = projectionData.findIndex((p) => p.label === label);
    const prev = idx > 0 ? projectionData[idx - 1] : null;
    const prevProjected = prev?.projected ?? 0;
    const currProjected = current.projected ?? 0;
    const delta = currProjected - prevProjected;
    const pct = prevProjected ? `${((delta / prevProjected) * 100).toFixed(1)}%` : 'n/a';

    return (
      <div className="rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg">
        <div className="font-semibold">{label}</div>
        <div className="mt-1 space-y-1">
          <div>Earnings: {formatCurrency(current.totalYield || 0)}</div>
          {prev && (
            <div className="text-xs text-purple-200">
              From {formatCurrency(prevProjected)} → {formatCurrency(currProjected)} | Δ {formatCurrency(delta)} ({pct})
            </div>
          )}
          {showIndividualAccounts && (
            <div className="pt-1 text-xs text-slate-200 space-y-1">
              {buildAccountBreakdown(current, prev).map((item) => (
                <div key={item.name}>
                  <span className="font-semibold">{item.name}:</span> {formatCurrency(item.current)} ({item.calc})
                  {item.net != null && (
                    <div className="text-[11px] text-emerald-200">
                      After-tax est: {formatCurrency(item.net)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  const totals = accounts.reduce(
    (acc, account) => {
      const value = CurrencyService.convertToBase(
        account.balance,
        account.currency,
        baseCurrency
      );
      if (account.type === 'cash') {
        acc.cash += value;
      } else {
        acc.invested += value;
      }
      if (account.taxable) {
        acc.taxed += value;
      } else {
        acc.nonTaxed += value;
      }
      return acc;
    },
    { invested: 0, cash: 0, taxed: 0, nonTaxed: 0 }
  );

  const investedVsCash = [
    { name: 'Invested', value: totals.invested, color: '#8b5cf6' },
    { name: 'Cash', value: totals.cash, color: '#22d3ee' }
  ];

  const taxedVsNonTaxed = [
    { name: 'Taxed', value: totals.taxed, color: '#f97316' },
    { name: 'Non-Taxed', value: totals.nonTaxed, color: '#34d399' }
  ];

  const getHoverTotals = () => {
    const source = hoverData;
    if (!source) return { invested: totals.invested, cash: totals.cash, taxed: totals.taxed, nonTaxed: totals.nonTaxed };
    // If per-account data exists, derive totals from it; otherwise fallback to current totals
    const hasPerAccount = accounts.some(acc => source[`account_${acc.id}`] != null);
    if (!hasPerAccount) return { invested: totals.invested, cash: totals.cash, taxed: totals.taxed, nonTaxed: totals.nonTaxed };
    let invested = 0;
    let cash = 0;
    let taxed = 0;
    let nonTaxed = 0;
    accounts.forEach(acc => {
      const val = source[`account_${acc.id}`];
      if (val == null || !selectedAccounts[acc.id]) return;
      if (acc.type === 'cash') {
        cash += val;
      } else {
        invested += val;
      }
      if (acc.taxable) taxed += val; else nonTaxed += val;
    });
    return { invested, cash, taxed, nonTaxed };
  };

  const hoverTotals = getHoverTotals();
  const hoverInvestedVsCash = [
    { name: 'Invested', value: hoverTotals.invested, color: '#8b5cf6' },
    { name: 'Cash', value: hoverTotals.cash, color: '#22d3ee' }
  ];
  const hoverTaxedVsNonTaxed = [
    { name: 'Taxed', value: hoverTotals.taxed, color: '#f97316' },
    { name: 'Non-Taxed', value: hoverTotals.nonTaxed, color: '#34d399' }
  ];

  const renderPieLegend = (data) => {
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    return (
      <div className="flex flex-col gap-1 text-sm text-slate-100">
        {data.map((entry) => {
          const pct = total ? `${((entry.value / total) * 100).toFixed(1)}%` : '0%';
          return (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name} — {pct}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => onTabChange('growth')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'growth'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-purple-200 hover:bg-white/10'
            }`}
          >
            Growth Projection
          </button>
          <button
            onClick={() => onTabChange('yields')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'yields'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-purple-200 hover:bg-white/10'
            }`}
          >
            Earnings
          </button>
        </div>
      </div>

      {/* Account Filters */}
      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <span className="text-purple-200 text-sm flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filter Accounts:
        </span>
        {accounts.map((account, idx) => (
          <label
            key={account.id}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/5 border border-white/20 cursor-pointer hover:bg-white/10 transition-all"
          >
            <input
              type="checkbox"
              checked={selectedAccounts[account.id] || false}
              onChange={() => onToggleAccount(account.id)}
              className="w-3 h-3"
            />
            <span className="text-white text-sm">{account.name}</span>
          </label>
        ))}
        <label className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/30 border border-purple-400/50 cursor-pointer hover:bg-purple-500/40 transition-all ml-4">
          <input
            type="checkbox"
            checked={showIndividualAccounts}
            onChange={(e) => onToggleIndividualAccounts(e.target.checked)}
            className="w-3 h-3"
          />
          <span className="text-white text-sm font-semibold">Show Individual Accounts</span>
        </label>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[530px]">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'growth' ? (
              <LineChart
                data={projectionData}
                onMouseMove={(state) => {
              const payload = state?.activePayload;
              if (payload && payload[0]?.payload) {
                setHoverData(payload[0].payload);
              }
            }}
            onMouseLeave={() => setHoverData(getDefaultHover())}
          >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="label" stroke="#ffffff80" />
                <YAxis
                  stroke="#ffffff80"
                  tickFormatter={(val) =>
                    `${CurrencyService.getSymbol(baseCurrency)}${(val / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip content={renderGrowthTooltip} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="#a78bfa"
                  strokeWidth={3}
                  dot={false}
                  animationDuration={1500}
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#34d399"
                  strokeWidth={3}
                  dot={{ fill: '#34d399', r: 4 }}
                  animationDuration={1500}
                  connectNulls
                />
                {showIndividualAccounts &&
                  accounts
                    .filter((acc) => selectedAccounts[acc.id])
                    .map((account, idx) => (
                      <Line
                        key={account.id}
                        type="monotone"
                        dataKey={`account_${account.id}`}
                        name={account.name}
                        stroke={getColorForIndex(idx, accounts.length)}
                        strokeWidth={2}
                        dot={false}
                        animationDuration={1500}
                      />
                    ))}
              </LineChart>
            ) : (
              <BarChart
                data={projectionData}
                onMouseMove={(state) => {
                const payload = state?.activePayload;
                if (payload && payload[0]?.payload) {
                  setHoverData(payload[0].payload);
                }
              }}
              onMouseLeave={() => setHoverData(getDefaultHover())}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                <XAxis dataKey="label" stroke="#ffffff80" />
                <YAxis
                  stroke="#ffffff80"
                  tickFormatter={(val) =>
                    `${CurrencyService.getSymbol(baseCurrency)}${(val / 1000).toFixed(0)}k`
                  }
                />
                <Tooltip content={renderEarningsTooltip} />
                <Legend />
                {showIndividualAccounts ? (
                  accounts
                    .filter((acc) => selectedAccounts[acc.id])
                    .map((account, idx) => (
                      <Bar
                        key={account.id}
                        dataKey={`account_${account.id}_yield`}
                        name={account.name}
                        fill={getColorForIndex(idx, accounts.length)}
                        animationDuration={1500}
                      />
                    ))
                ) : (
                  <Bar
                    dataKey="totalYield"
                    name="Total Earnings"
                    fill="#a78bfa"
                    animationDuration={1500}
                  />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/20 h-[250px]">
            <h4 className="text-white font-semibold mb-3">Invested vs Cash</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 28, left: 8 }}>
                <Pie
                  data={hoverInvestedVsCash}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={64}
                  innerRadius={34}
                  paddingAngle={1}
                  stroke="#0f172a"
                >
                  {hoverInvestedVsCash.map((entry, index) => (
                    <Cell key={`ivc-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e1b4b',
                    border: '1px solid #ffffff30',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                  labelStyle={{ color: '#ffffff' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(value, name) => {
                    const total = hoverInvestedVsCash.reduce((sum, item) => sum + (item.value || 0), 0);
                    const pct = total ? ` (${((value / total) * 100).toFixed(1)}%)` : '';
                    return [`${CurrencyService.formatCurrency(value, baseCurrency)}${pct}`, name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  content={() => renderPieLegend(hoverInvestedVsCash)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/20 h-[250px]">
            <h4 className="text-white font-semibold mb-3">Taxed vs Non-Taxed</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 28, left: 8 }}>
                <Pie
                  data={hoverTaxedVsNonTaxed}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={64}
                  innerRadius={34}
                  paddingAngle={1}
                  stroke="#0f172a"
                >
                  {hoverTaxedVsNonTaxed.map((entry, index) => (
                    <Cell key={`tvnt-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e1b4b',
                    border: '1px solid #ffffff30',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                  labelStyle={{ color: '#ffffff' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  formatter={(value, name) => {
                    const total = hoverTaxedVsNonTaxed.reduce((sum, item) => sum + (item.value || 0), 0);
                    const pct = total ? ` (${((value / total) * 100).toFixed(1)}%)` : '';
                    return [`${CurrencyService.formatCurrency(value, baseCurrency)}${pct}`, name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  content={() => renderPieLegend(hoverTaxedVsNonTaxed)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
