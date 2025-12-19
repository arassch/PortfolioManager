import React, { useEffect, useState, useMemo } from 'react';
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
  Cell,
  ReferenceLine,
  ReferenceDot
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
  onToggleAccount,
  projectionYears,
  onUpdateProjectionYears,
  onSelectAllAccounts,
  onSelectNoAccounts,
  fiTarget
}) {
  const [hoverRow, setHoverRow] = useState(data[data.length - 1] || null);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const formatCurrency = (value) => CurrencyService.formatCurrency(value || 0, baseCurrency);
  const hasActualData = data.some(row => row.actual != null);
  const TIME_TRAVEL_YEARS = Math.max(0, Math.floor(Number(import.meta.env.VITE_TIME_TRAVEL_YEARS || 0)));
  const nowYear = new Date().getFullYear() + TIME_TRAVEL_YEARS;
  const formatYAxisTick = (val) => {
    const symbol = CurrencyService.getSymbol(baseCurrency);
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${symbol}${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${symbol}${(val / 1_000).toFixed(1)}k`;
    return `${symbol}${val.toFixed(0)}`;
  };
  const nowLabel = useMemo(() => {
    if (!data || data.length === 0) return null;
    const years = data.map((row) => row.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    if (nowYear === minYear) return null;
    if (nowYear < minYear) return data[0]?.label ?? null;
    if (nowYear >= maxYear) return data[data.length - 1]?.label ?? null;
    const exact = data.find((row) => row.year === nowYear);
    if (exact) return exact.label;
    const next = data.find((row) => row.year > nowYear);
    return next?.label ?? data[data.length - 1]?.label ?? null;
  }, [data, nowYear]);

  useEffect(() => {
    const defaultRow = data.find((row) => row.year === nowYear) || data[data.length - 1] || null;
    setHoverRow(defaultRow);
  }, [data, nowYear]);

  const fiMarkers = fiTarget
    ? projections
        .map((proj) => {
          const col = `projection_${proj.id}`;
          const hit = data.find((row) => row[col] != null && row[col] >= fiTarget);
          if (!hit) return null;
          return { label: hit.label, year: hit.year, name: proj.name };
        })
        .filter(Boolean)
    : [];

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
    const hasActual = point.actual != null;
    return (
      <div className="rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg">
        <div className="font-semibold">Year {label}</div>
        <div className="space-y-1 mt-1">
          {hasActual && (
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
    <div data-tour="analysis-chart" className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
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

      <div className="mt-4 mb-6 flex flex-wrap gap-3 items-center">
        {onUpdateProjectionYears && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-purple-100">Projection Years</label>
            <input
              type="number"
              min="1"
              value={projectionYears ?? ''}
              onChange={(e) => onUpdateProjectionYears(e.target.value)}
              className="w-24 px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-sm"
            />
          </div>
        )}
        <div className="relative">
          <button
            onClick={() => setShowAccountDropdown(prev => !prev)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/15 transition"
          >
            <Filter className="w-4 h-4" />
            <span>Filter Accounts</span>
          </button>
          {showAccountDropdown && (
            <div className="absolute z-20 mt-2 w-64 bg-slate-900/95 border border-white/20 rounded-lg shadow-lg p-3 space-y-2">
              <div className="flex gap-2 justify-between">
                <button
                  className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 text-white hover:bg-white/15 transition"
                  onClick={() => {
                    onSelectAllAccounts?.();
                    setShowAccountDropdown(false);
                  }}
                >
                  Select all
                </button>
                <button
                  className="text-xs px-2 py-1 rounded bg-white/10 border border-white/20 text-white hover:bg-white/15 transition"
                  onClick={() => {
                    onSelectNoAccounts?.();
                    setShowAccountDropdown(false);
                  }}
                >
                  Select none
                </button>
              </div>
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className="flex items-center gap-2 text-sm text-white cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedAccounts[account.id] || false}
                    onChange={() => onToggleAccount(account.id)}
                    className="w-3 h-3"
                  />
                  <span>{account.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
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
                tickFormatter={formatYAxisTick}
            />
            <Tooltip content={renderTooltip} />
            <Legend />
            {nowLabel && (
              <ReferenceLine
                x={nowLabel}
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="6 6"
                label={{ position: 'top', value: 'Now', fill: '#fbbf24', fontSize: 12 }}
              />
            )}
              {fiTarget > 0 && (
                <>
                  <ReferenceLine
                    y={fiTarget}
                    stroke="#34d39980"
                    strokeDasharray="4 6"
                    strokeWidth={1.5}
                  />
                  {fiMarkers.map((marker, idx) => (
                    <ReferenceLine
                      key={`${marker.label}-${idx}`}
                      x={marker.label}
                      stroke="#22d3ee70"
                      strokeDasharray="2 6"
                      strokeWidth={1}
                    />
                  ))}
                  {fiMarkers.map((marker, idx) => (
                    <ReferenceDot
                      key={`dot-${marker.label}-${idx}`}
                      x={marker.label}
                      y={fiTarget}
                      r={6}
                      fill="#34d399"
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  ))}
                </>
              )}
              {hasActualData && (
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual data"
                  stroke="#34d399"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, stroke: '#0f172a', strokeWidth: 1, fill: '#34d399' }}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
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
