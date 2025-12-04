import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import CurrencyService from '../services/CurrencyService';

export function TransferRuleItem({ rule, accounts, onEdit, onDelete }) {
  const fromAccount = accounts.find(acc => acc.id == rule.fromAccountId);

  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/20">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h4 className="text-white font-semibold mb-2">
            {rule.fromExternal ? (
              <>
                From: <span className="text-green-300">External</span>{' '}
                <span className="text-purple-200 text-sm">
                  ({CurrencyService.formatCurrency(rule.externalAmount, rule.externalCurrency)}/{rule.frequency})
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
          <div className="space-y-1">
            {rule.transfers?.map((transfer, index) => {
              const toAccount = accounts.find(acc => acc.id == transfer.toAccountId);
              const splitAmount = rule.amountType === 'earnings'
                ? 'equal split of earnings'
                : CurrencyService.formatCurrency(
                    rule.externalAmount / rule.transfers.length,
                    rule.fromExternal ? rule.externalCurrency : (fromAccount?.currency || 'USD')
                  );
              return (
                <div key={index} className="text-sm text-purple-200">
                  → {toAccount ? (
                    <span className="text-white">{toAccount.name}</span>
                  ) : (
                    <span className="text-red-300">Deleted Account</span>
                  )} <span className="text-blue-300">({splitAmount})</span>
                </div>
              );
            })}
          </div>
        </div>
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
  );
}