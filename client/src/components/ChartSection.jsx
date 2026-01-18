import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceDot, Scatter,
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
  birthdate,
  taxRate,
  projectionName,
  accountFilterHint,
  onTabChange,
  onToggleAccount,
  onToggleIndividualAccounts,
  inflationRate = 0,
  projectionYears,
  onUpdateProjectionYears,
  onSelectAllAccounts,
  onSelectNoAccounts,
  fiTarget
}) {
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const formatCurrency = (value) => CurrencyService.formatCurrency(value, baseCurrency);
  const formatYAxisTick = (val) => {
    const symbol = CurrencyService.getSymbol(baseCurrency);
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `${symbol}${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${symbol}${(val / 1_000).toFixed(1)}k`;
    return `${symbol}${val.toFixed(0)}`;
  };
  const TIME_TRAVEL_YEARS = Math.max(0, Math.floor(Number(import.meta.env.VITE_TIME_TRAVEL_YEARS || 0)));
  const nowYear = new Date().getFullYear() + TIME_TRAVEL_YEARS;
  const { projectedTicks, projectedDomain } = useMemo(() => {
    const start = nowYear;
    const end = nowYear + (projectionYears ?? 0);
    const ticks = [];
    for (let y = start; y <= end; y++) {
      ticks.push(y);
    }
    return { projectedTicks: ticks, projectedDomain: [start, end] };
  }, [nowYear, projectionYears]);
  const nowCoord = nowYear;
  const nowLabel = useMemo(() => {
    if (!projectionData || projectionData.length === 0) return null;
    const years = projectionData.map((p) => p.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    if (nowYear === minYear) return null;
    if (nowYear < minYear) return projectionData[0]?.label ?? null;
    if (nowYear >= maxYear) return projectionData[projectionData.length - 1]?.label ?? null;
    const exact = projectionData.find((p) => p.year === nowYear);
    if (exact) return exact.label;
    const next = projectionData.find((p) => p.year > nowYear);
    return next?.label ?? projectionData[projectionData.length - 1]?.label ?? null;
  }, [projectionData, nowYear]);
  const currentYear = nowYear;

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
  const getAccountColor = (accountId) => {
    const idx = accounts.findIndex((a) => a.id === accountId);
    return getColorForIndex(idx >= 0 ? idx : 0, accounts.length);
  };
  const getAgeAtLabel = (label) => {
    if (!birthdate || !label) return null;
    const bd = new Date(birthdate);
    if (Number.isNaN(bd.getTime())) return null;
    let year = Number(label);
    if (!Number.isFinite(year)) {
      const parsed = new Date(label);
      if (Number.isNaN(parsed.getTime())) return null;
      year = parsed.getUTCFullYear();
    }
    const birthYear = bd.getFullYear();
    return Math.max(0, year - birthYear);
  };

  const fiReachPoint = fiTarget
    ? projectionData.find((p) => p.projected != null && p.projected >= fiTarget)
    : null;
  const fiYearLabel = fiReachPoint?.label;

  const buildAccountBreakdown = (current, prev, useReturns = false) => {
    return accounts
      .filter((acc) => selectedAccounts[acc.id])
      .map((acc) => {
        const nominalRate =
          (typeof acc.getReturnRate === 'function' ? acc.getReturnRate() : null) ??
          acc.returnRate ??
          0;
        const inflationPct = inflationRate ?? 0;
        const realRatePct = ((1 + nominalRate / 100) / (1 + inflationPct / 100) - 1) * 100;

        const prevVal = prev ? prev[useReturns ? `account_${acc.id}_return` : `account_${acc.id}`] : null;
        const currVal = current ? current[useReturns ? `account_${acc.id}_return` : `account_${acc.id}`] : null;
        const actualVal = current ? current[`account_${acc.id}_actual`] : null;
        const currNet = current ? current[`account_${acc.id}_net`] : null;
        if (currVal == null) return null;

        let calc = '';
        let estTax = null;
        if (useReturns) {
          calc = `earnings ${formatCurrency(currVal)}`;
        } else {
          const monthlyReal = Math.pow(1 + realRatePct / 100, 1 / 12) - 1;
          const transferNet = current[`account_${acc.id}_transfers`] || 0;
          const calcParts = [
            prevVal != null ? `prev ${formatCurrency(prevVal)}` : null,
            `x real ${realRatePct.toFixed(2)}%`,
            transferNet ? `${transferNet > 0 ? '+ transfers ' : '- transfers '}${formatCurrency(Math.abs(transferNet))}` : null,
            `= ${formatCurrency(currVal)}`
          ].filter(Boolean);
          calc = calcParts.join(' ');
          estTax = currNet != null ? Math.max(currVal - currNet, 0) : null;
        }

        const color = getAccountColor(acc.id);
        return {
          name: acc.name,
          current: currVal,
          net: currNet,
          estTax,
          calc,
          color,
          actualVal
        };
      })
      .filter(Boolean);
  };

  const renderGrowthTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const current = payload[0].payload;
    const labelStr = current?.label || label;
    const idx = projectionData.findIndex((p) => p.label === labelStr);
    const prev = idx > 0 ? projectionData[idx - 1] : null;
    const prevValue = prev?.projected ?? 0;
    const delta = (current.projected ?? 0) - prevValue;
    const pct = prevValue ? `${((delta / prevValue) * 100).toFixed(1)}%` : 'n/a';
    const net = current.projectedNet != null ? current.projectedNet : null;
    const estTax = net != null && current.projected != null ? Math.max(current.projected - net, 0) : null;
    const age = getAgeAtLabel(labelStr);
    const actualItems = accounts
      .filter((acc) => current[`account_${acc.id}_observed`] != null)
      .map((acc) => ({
        name: acc.name,
        value: current[`account_${acc.id}_observed`],
        color: getAccountColor(acc.id)
      }));
    const hasProjected = current.projected != null;

    return (
      <div className="rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg">
        <div className="font-semibold">{labelStr}</div>
        <div className="mt-1 space-y-1">
          {age != null && <div className="text-xs text-purple-200">Age: {age}</div>}
          {hasProjected && (
            <>
              <div>Projected: {formatCurrency(current.projected)}</div>
              {prev && (
                <div className="text-xs text-purple-200">
                  Prev: {formatCurrency(prevValue)} | Δ {formatCurrency(delta)} ({pct})
                </div>
              )}
              {net != null && (
                <div className="text-emerald-200">
                  After-tax est: {formatCurrency(net)}{estTax != null ? ` (Est tax: ${formatCurrency(estTax)})` : ''}
                </div>
              )}
            </>
          )}
          {!hasProjected && actualItems.length === 0 && current.actual != null && (
            <div>Actual: {formatCurrency(current.actual)}</div>
          )}

          {showIndividualAccounts && (
            <div className="pt-1 text-xs text-slate-200 space-y-1">
              {hasProjected &&
                buildAccountBreakdown(current, prev).map((item) => (
                  <div key={item.name} className="flex items-start gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full mt-1"
                      style={{ backgroundColor: item.color }}
                    />
                    <div>
                      <span className="font-semibold">{item.name}:</span> {formatCurrency(item.current)} ({item.calc})
                      {item.net != null && item.estTax != null && item.estTax > 0 && (
                        <div className="text-[11px] text-emerald-200">
                          After-tax est: {formatCurrency(item.net)}{item.estTax != null ? ` (Est tax: ${formatCurrency(item.estTax)})` : ''}
                        </div>
                      )}
                      {item.actualVal != null && (
                        <div className="text-[11px] text-green-200 flex items-center gap-1">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full border"
                            style={{ borderColor: item.color, backgroundColor: 'transparent' }}
                          />
                          <span>Actual {item.name}: {formatCurrency(item.actualVal)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              {!hasProjected && actualItems.length > 0 && actualItems.map((item) => (
                <div key={item.name} className="flex items-start gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full mt-1 border"
                    style={{ borderColor: item.color, backgroundColor: 'transparent' }}
                  />
                  <div>
                    <span className="font-semibold">{item.name}:</span> {formatCurrency(item.value)}
                  </div>
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
    const labelStr = current?.label || label;
    const idx = projectionData.findIndex((p) => p.label === labelStr);
    const prev = idx > 0 ? projectionData[idx - 1] : null;
    const prevProjected = prev?.projected ?? 0;
    const currProjected = current.projected ?? 0;
    const delta = currProjected - prevProjected;
    const pct = prevProjected ? `${((delta / prevProjected) * 100).toFixed(1)}%` : 'n/a';
    const net = current.projectedNet != null ? current.projectedNet : null;
    const estTax = net != null && current.projected != null ? Math.max(current.projected - net, 0) : null;
    const age = getAgeAtLabel(labelStr);

    return (
      <div className="rounded-lg border border-white/20 bg-slate-900/95 px-3 py-2 text-sm text-white shadow-lg">
        <div className="font-semibold">{labelStr}</div>
        <div className="mt-1 space-y-1">
          {age != null && <div className="text-xs text-purple-200">Age: {age}</div>}
          <div>Earnings: {formatCurrency(current.totalReturn || 0)}</div>
          {/* {net != null && (
            <div className="text-emerald-200">
              After-tax est: {formatCurrency(net)}{estTax != null ? ` (Est tax: ${formatCurrency(estTax)})` : ''}
            </div>
          )} */}
          {/* <div className="text-xs text-purple-200">Real return rate = ((1 + nominal rate) / (1 + inflation)) - 1.</div> */}
          {prev && (
            <div className="text-xs text-purple-200">
              From {formatCurrency(prevProjected)} → {formatCurrency(currProjected)} | Δ {formatCurrency(delta)} ({pct})
            </div>
          )}
          {showIndividualAccounts && (
            <div className="pt-1 text-xs text-slate-200 space-y-1">
              {buildAccountBreakdown(current, prev, true).map((item) => (
                <div key={item.name} className="flex items-start gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full mt-1"
                    style={{ backgroundColor: item.color }}
                  />
                  <div>
                    <span className="font-semibold">{item.name}:</span> {formatCurrency(item.current)} ({item.calc})
                    {item.actualVal != null && (
                      <div className="text-[11px] text-green-200 flex items-center gap-1">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full border"
                          style={{ borderColor: item.color, backgroundColor: 'transparent' }}
                        />
                        <span>Actual {item.name}: {formatCurrency(item.actualVal)}</span>
                      </div>
                    )}
                    {item.net != null && item.estTax != null && item.estTax > 0 && (
                      <div className="text-[11px] text-emerald-200">
                        After-tax est: {formatCurrency(item.net)}
                      </div>
                    )}
                  </div>
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
      if (account.taxTreatment !== 'roth') {
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
      if (acc.taxTreatment !== 'roth') taxed += val; else nonTaxed += val;
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

  const observedDots = useMemo(() => {
    const dots = [];
    (projectionData || []).forEach((p) => {
      accounts
        .filter((acc) => selectedAccounts[acc.id] !== false) // default to included
        .forEach((acc) => {
          const val = p[`account_${acc.id}_observed`];
          if (val != null && Number.isFinite(p.xCoord)) {
            dots.push({
              x: p.xCoord,
              y: val,
              color: getColorForIndex(accounts.findIndex((a) => a.id === acc.id), accounts.length)
            });
          }
        });
    });
    return dots;
  }, [projectionData, accounts, selectedAccounts]);

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
    <div data-tour="projection-chart" className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase text-purple-200 tracking-wide">Projection view</p>
          <h4 className="text-white font-semibold">{projectionName || 'Active Projection'}</h4>
          <p className="text-purple-200 text-xs">
            {accountFilterHint || 'Account filters carry across projections and charts.'}
          </p>
        </div>
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
            onClick={() => onTabChange('returns')}
            className={`px-4 py-2 rounded-lg transition-all ${
              activeTab === 'returns'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-purple-200 hover:bg-white/10'
            }`}
          >
            Earnings
          </button>
        </div>
      </div>

      {/* Projection years + Account Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
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
                  const first = payload && payload[0]?.payload;
                  if (first && first.projected != null) {
                    setHoverData(first);
                  }
                }}
                onMouseLeave={() => setHoverData(getDefaultHover())}
              >
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis
                type="number"
                dataKey="xCoord"
                stroke="#ffffff80"
                ticks={projectedTicks}
                tickFormatter={(val) => Math.round(val).toString()}
                domain={projectedDomain}
              />
              <YAxis
                stroke="#ffffff80"
                tickFormatter={formatYAxisTick}
              />
              <Tooltip content={renderGrowthTooltip} />
              <Legend />
              {nowLabel && (
                <ReferenceLine
                  x={nowCoord}
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
                  {fiYearLabel && (
                    <ReferenceLine
                      x={Number(fiYearLabel)}
                      stroke="#22d3ee70"
                      strokeDasharray="2 6"
                      strokeWidth={1}
                    />
                  )}
                  {fiYearLabel && (
                    <ReferenceDot
                      x={Number(fiYearLabel)}
                      y={fiTarget}
                      r={6}
                      fill="#34d399"
                      stroke="#0f172a"
                      strokeWidth={1}
                    />
                  )}
                </>
              )}
              <Line
                type="monotone"
                dataKey="projected"
                stroke="#a78bfa"
                strokeWidth={3}
                dot={false}
                connectNulls
                animationDuration={1500}
              />
              {showIndividualAccounts &&
                accounts
                  .filter((acc) => selectedAccounts[acc.id])
                  .map((account) => {
                    const color = getAccountColor(account.id);
                    return (
                      <React.Fragment key={account.id}>
                        <Line
                          type="monotone"
                          dataKey={`account_${account.id}`}
                          name={account.name}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                          animationDuration={1500}
                        />
                      </React.Fragment>
                    );
                  })}
              {accounts
                .filter((acc) => selectedAccounts[acc.id])
                .map((account) => {
                  const color = getAccountColor(account.id);
                  return (
                    <Line
                      key={`observed-${account.id}`}
                      type="monotone"
                      dataKey={`account_${account.id}_observed`}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="3 6"
                      dot={false}
                      connectNulls
                      legendType="none"
                      isAnimationActive={false}
                    />
                  );
                })}
              {observedDots.length > 0 &&
                observedDots.map((dot, idx) => (
                  <ReferenceDot
                    key={`obs-${idx}`}
                    x={dot.x}
                    y={dot.y}
                    r={4}
                    fill="#0f172a"
                    stroke={dot.color || '#fff'}
                    strokeWidth={1.5}
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
                <XAxis
                  type="number"
                  dataKey="xCoord"
                  stroke="#ffffff80"
                  ticks={projectedTicks}
                  tickFormatter={(val) => Math.round(val).toString()}
                  domain={projectedDomain}
                />
                <YAxis
                  stroke="#ffffff80"
                  tickFormatter={formatYAxisTick}
                />
                <Tooltip content={renderEarningsTooltip} />
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
                {showIndividualAccounts ? (
                  accounts
                    .filter((acc) => selectedAccounts[acc.id])
                    .map((account) => (
                      <Bar
                        key={account.id}
                        dataKey={`account_${account.id}_return`}
                        name={account.name}
                        fill={getAccountColor(account.id)}
                        animationDuration={1500}
                      />
                    ))
                ) : (
                  <Bar
                    dataKey="totalReturn"
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
