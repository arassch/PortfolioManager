import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Filter } from 'lucide-react';
import CurrencyService from '../services/CurrencyService';
import { getColorForIndex } from '../utils/helpers';

export function ProjectionComparisonSection({
  data,
  projections,
  accounts,
  baseCurrency,
  selectedAccounts,
  onToggleAccount
}) {
  const [hoverRow, setHoverRow] = useState(data[data.length - 1] || null);
  const formatCurrency = (value) => CurrencyService.formatCurrency(value || 0, baseCurrency);

  useEffect(() => {
    setHoverRow(data[data.length - 1] || null);
  }, [data]);

  const totals = accounts.reduce(
    (acc, account) => {
      if (selectedAccounts[account.id] === false) return acc;
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

  const renderTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    return (
      <div className="rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg">
        <div className="font-semibold">Year {label}</div>
        <div className="space-y-1 mt-1">
          {point.actual != null && (
            <div className="text-green-200">Actual data: {formatCurrency(point.actual)}</div>
          )}
          {projections.map((proj, idx) => {
            const key = `projection_${proj.id}`;
            const value = point[key];
            if (value == null) return null;
            return (
              <div key={proj.id} className="flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: getColorForIndex(idx, projections.length) }}
                />
                <span className="text-purple-100">{proj.name}: {formatCurrency(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPieLegend = (pieData) => {
    const total = pieData.reduce((sum, item) => sum + (item.value || 0), 0);
    return (
      <div className="flex flex-col gap-1 text-sm text-slate-100">
        {pieData.map((entry) => {
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

  if (!projections.length) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-2">Portfolio Overview</h3>
        <p className="text-purple-200 text-sm">Add a projection to compare scenarios.</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <p className="text-xs uppercase text-purple-200 tracking-wide">Portfolio Overview</p>
          <h3 className="text-xl font-bold text-white">Actual data + multi-projection net worth</h3>
          <p className="text-purple-200 text-sm">
            Accounts and data points are shared across every projection. The lines below show total net worth per scenario.
          </p>
        </div>
        {hoverRow && (
          <div className="text-right text-sm text-purple-100">
            <div className="font-semibold text-white">Hover year: {hoverRow.label}</div>
            {hoverRow.actual != null && (
              <div>Actual: {formatCurrency(hoverRow.actual)}</div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 mb-6 flex flex-wrap gap-2 items-center">
        <span className="text-purple-200 text-sm flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Account filters (applies to all charts):
        </span>
        {accounts.map((account) => (
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
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[460px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              onMouseMove={(state) => {
                const payload = state?.activePayload;
                if (payload && payload[0]?.payload) {
                  setHoverRow(payload[0].payload);
                }
              }}
              onMouseLeave={() => setHoverRow(data[data.length - 1] || null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis dataKey="label" stroke="#ffffff80" />
              <YAxis
                stroke="#ffffff80"
                tickFormatter={(val) =>
                  `${CurrencyService.getSymbol(baseCurrency)}${(val / 1000).toFixed(0)}k`
                }
              />
              <Tooltip content={renderTooltip} />
              <Legend />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual data"
                stroke="#34d399"
                strokeWidth={3}
                dot={{ fill: '#34d399', r: 4 }}
                connectNulls
              />
              {projections.map((proj, idx) => (
                <Line
                  key={proj.id}
                  type="monotone"
                  dataKey={`projection_${proj.id}`}
                  name={proj.name}
                  stroke={getColorForIndex(idx, projections.length)}
                  strokeWidth={2.5}
                  dot={false}
                  animationDuration={1200}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <div className="bg-white/5 rounded-lg p-4 border border-white/20 h-[215px]">
            <h4 className="text-white font-semibold mb-3">Invested vs Cash (current)</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 28, left: 8 }}>
                <Pie
                  data={investedVsCash}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={58}
                  innerRadius={30}
                  paddingAngle={1}
                  stroke="#0f172a"
                >
                  {investedVsCash.map((entry, index) => (
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
                    const total = investedVsCash.reduce((sum, item) => sum + (item.value || 0), 0);
                    const pct = total ? ` (${((value / total) * 100).toFixed(1)}%)` : '';
                    return [`${CurrencyService.formatCurrency(value, baseCurrency)}${pct}`, name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  content={() => renderPieLegend(investedVsCash)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/20 h-[215px]">
            <h4 className="text-white font-semibold mb-3">Taxed vs Non-Taxed (current)</h4>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 8, bottom: 28, left: 8 }}>
                <Pie
                  data={taxedVsNonTaxed}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={58}
                  innerRadius={30}
                  paddingAngle={1}
                  stroke="#0f172a"
                >
                  {taxedVsNonTaxed.map((entry, index) => (
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
                    const total = taxedVsNonTaxed.reduce((sum, item) => sum + (item.value || 0), 0);
                    const pct = total ? ` (${((value / total) * 100).toFixed(1)}%)` : '';
                    return [`${CurrencyService.formatCurrency(value, baseCurrency)}${pct}`, name];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  content={() => renderPieLegend(taxedVsNonTaxed)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
