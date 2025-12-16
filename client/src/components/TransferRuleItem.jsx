import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import CurrencyService from '../services/CurrencyService';

export function TransferRuleItem({ rule, accounts, onEdit, onDelete }) {
  const fromAccount = accounts.find(acc => acc.id == rule.fromAccountId);
  const toAccount = accounts.find(acc => acc.id == rule.toAccountId);
  const isExternalOutcome = (rule.toExternal === true || rule.direction === 'output') && !toAccount;
  const isExternalIncome = rule.fromExternal === true || rule.direction === 'input';
  const externalLabel = rule.externalTarget || 'External';
  const amountText = rule.amountType === 'earnings'
    ? `${rule.externalAmount || 0}%`
    : CurrencyService.formatCurrency(
        rule.externalAmount,
        rule.fromExternal ? rule.externalCurrency : (fromAccount?.currency || rule.externalCurrency || 'USD')
      );
  const dateLabel = (() => {
    const start = rule.startDate ? new Date(rule.startDate).toISOString().slice(0,10) : null;
    const end = rule.endDate ? new Date(rule.endDate).toISOString().slice(0,10) : null;
    if (rule.frequency === 'one_time' && start) return `(${start})`;
    if (start && end) return `(${start} → ${end})`;
    if (start) return `(${start} → ∞)`;
    return '';
  })();

  return (
    <div className="bg-white/5 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="text-white font-semibold mb-2">
            {isExternalIncome ? (
              <>
                From: <span className="text-green-300">External</span>{' '}
                <span className="text-purple-200 text-sm">
                  ({amountText}/{rule.frequency})
                </span>
              </>
            ) : (
              <>
                From: {fromAccount ? (
                  <span className="text-blue-300">{fromAccount.name}</span>
                ) : (
                  <span className="text-red-300">Deleted Account</span>
                )}{' '}
                <span className="text-purple-200 text-sm">
                  ({rule.amountType === 'earnings' ? 'earnings' : `${CurrencyService.formatCurrency(rule.externalAmount, fromAccount?.currency || 'USD')}`}/{rule.frequency})
                </span>
              </>
            )}
          </h4>
          <div className="space-y-1 text-sm text-purple-200">
            → {isExternalOutcome ? (
              <span className="text-white">{externalLabel}</span>
            ) : toAccount ? (
              <span className="text-white">{toAccount.name}</span>
            ) : (
              <span className="text-red-300">Deleted Account</span>
            )}{' '}
            <span className="text-blue-300">
              ({amountText} · {rule.amountType})
            </span>
            {rule.externalTarget ? (
              <span className="text-purple-200 text-xs ml-2">Label: {rule.externalTarget}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {dateLabel && <span className="text-purple-300 text-xs">{dateLabel}</span>}
          <div className="flex gap-2">
            <button onClick={() => onEdit(rule)} className="p-2 text-blue-400 hover:text-blue-300">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(rule.id)} className="p-2 text-red-400 hover:text-red-300">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
