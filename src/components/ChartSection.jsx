import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
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
  onTabChange,
  onToggleAccount,
  onToggleIndividualAccounts
}) {
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

      <ResponsiveContainer width="100%" height={400}>
        {activeTab === 'growth' ? (
          <LineChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis dataKey="label" stroke="#ffffff80" />
            <YAxis
              stroke="#ffffff80"
              tickFormatter={(val) =>
                `${CurrencyService.getSymbol(baseCurrency)}${(val / 1000).toFixed(0)}k`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e1b4b',
                border: '1px solid #ffffff30',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#ffffff' }}
              formatter={(value) => [
                `${CurrencyService.getSymbol(baseCurrency)}${value.toLocaleString()}`,
                ''
              ]}
            />
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
          <BarChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
            <XAxis dataKey="label" stroke="#ffffff80" />
            <YAxis
              stroke="#ffffff80"
              tickFormatter={(val) =>
                `${CurrencyService.getSymbol(baseCurrency)}${(val / 1000).toFixed(0)}k`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e1b4b',
                border: '1px solid #ffffff30',
                borderRadius: '8px'
              }}
              labelStyle={{ color: '#ffffff' }}
              formatter={(value, name) => [
                `${CurrencyService.getSymbol(baseCurrency)}${value?.toLocaleString() || '0'}`,
                name
              ]}
            />
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
  );
}