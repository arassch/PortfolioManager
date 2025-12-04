import { Account } from './Account';
import { TransferRule } from './TransferRule';

/**
 * Portfolio model - represents the entire portfolio state
 */
export class Portfolio {
  constructor(data = {}) {
    this.accounts = (data.accounts || []).map(acc => new Account(acc));
    this.transferRules = (data.transferRules || []).map(rule => new TransferRule(rule));
    this.actualValues = data.actualValues || {};
    this.projectionYears = data.projectionYears || 10;
    this.defaultInvestmentYield = data.defaultInvestmentYield || 7;
    this.taxRate = data.taxRate || 25;
    this.baseCurrency = data.baseCurrency || 'USD';
  }

  getAccountById(id) {
    return this.accounts.find(acc => acc.id == id || String(acc.id) === String(id));
  }

  getTotalBalance(convertToBase) {
    return this.accounts.reduce((sum, acc) => 
      sum + convertToBase(acc.balance, acc.currency), 0
    );
  }

  toJSON() {
    return {
      accounts: this.accounts.map(acc => acc.toJSON()),
      transferRules: this.transferRules.map(rule => rule.toJSON()),
      actualValues: this.actualValues,
      projectionYears: this.projectionYears,
      defaultInvestmentYield: this.defaultInvestmentYield,
      taxRate: this.taxRate,
      baseCurrency: this.baseCurrency
    };
  }
}