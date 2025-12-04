import React from 'react';
import { DollarSign, TrendingUp } from 'lucide-react';
import { CURRENCY_SYMBOLS } from '../constants/currencies';

export function SummaryCard({ title, value, currency, icon: Icon, isLarge = false }) {
  const formattedValue = currency && typeof value === 'number'
    ? `${CURRENCY_SYMBOLS[currency] || currency}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : value;

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-purple-200 text-sm mb-1">{title}</p>
          <p className={`font-bold text-white ${isLarge ? 'text-3xl' : 'text-lg'}`}>
            {formattedValue}
          </p>
        </div>
        {Icon && <Icon className="w-12 h-12 text-purple-400" />}
      </div>
    </div>
  );
}