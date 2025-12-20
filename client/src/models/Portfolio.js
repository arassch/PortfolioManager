import { Account } from './Account';
import { TransferRule } from './TransferRule';
import { Projection } from './Projection';

/**
 * Portfolio model - represents the entire portfolio state
 */
export class Portfolio {
  constructor(data = {}) {
    this.accounts = (data.accounts || []).map(acc => new Account(acc));
    this.transferRules = (data.transferRules || []).map(rule => new TransferRule(rule));
    this.actualValues = data.actualValues || {};
    this.projectionYears = data.projectionYears || 10;
    this.taxRate = data.taxRate || 25;
    this.baseCurrency = data.baseCurrency || 'USD';
    this.fiMode = data.fiMode || 'annual_expenses'; // 'value' | 'annual_expenses' | 'monthly_expenses'
    this.fiMultiplier = data.fiMultiplier != null ? data.fiMultiplier : 25;
    this.fiAnnualExpenses = data.fiAnnualExpenses || 0;
    this.fiMonthlyExpenses = data.fiMonthlyExpenses || 0;
    this.fiValue = data.fiValue || 0;
    this.birthdate = data.birthdate || null;
    const projectionsFromData = (data.projections || []).map(p => new Projection(p));

    if (projectionsFromData.length > 0) {
      this.projections = projectionsFromData;
    } else {
      const legacyOverrides = {};
      this.accounts.forEach(acc => {
        legacyOverrides[acc.id] = {
          returnRate: acc.returnRate
        };
      });
      this.projections = [
        new Projection({
          name: 'Projection 1',
          transferRules: this.transferRules,
          accountOverrides: legacyOverrides
        })
      ];
    }
    this.activeProjectionId =
      data.activeProjectionId ||
      (this.projections[0] ? this.projections[0].id : null);
  }

  getAccountById(id) {
    return this.accounts.find(acc => acc.id == id || String(acc.id) === String(id));
  }

  getTotalBalance(convertToBase) {
    return this.accounts.reduce((sum, acc) => 
      sum + convertToBase(acc.balance, acc.currency), 0
    );
  }

  getProjectionById(id) {
    return this.projections.find(p => String(p.id) === String(id));
  }

  getActiveProjection() {
    const selected = this.getProjectionById(this.activeProjectionId);
    if (selected) return selected;
    return this.projections[0] || null;
  }

  buildProjectionView(projectionId) {
    const projection = this.getProjectionById(projectionId) || this.getActiveProjection();
    if (!projection) return this;

    const accounts = this.accounts.map(acc => {
      const overrides = projection.accountOverrides?.[acc.id] || projection.accountOverrides?.[String(acc.id)] || {};
      const overrideRate = overrides.returnRate;
      return new Account({
        ...acc,
        returnRate: overrideRate ?? acc.returnRate
      });
    });

    return {
      accounts,
      transferRules: projection.transferRules,
      inflationRate: projection.inflationRate ?? 0,
      actualValues: this.actualValues,
      projectionYears: this.projectionYears,
      taxRate: this.taxRate,
      baseCurrency: this.baseCurrency,
      fiTarget: this.getFiTarget(),
      getAccountById: (accountId) =>
        accounts.find(a => a.id == accountId || String(a.id) === String(accountId))
    };
  }

  getFiTarget() {
    const multiplier = Number.isFinite(this.fiMultiplier) ? this.fiMultiplier : 25;
    if (this.fiMode === 'value') {
      return Math.max(Number(this.fiValue) || 0, 0);
    }
    if (this.fiMode === 'monthly_expenses') {
      const monthly = Math.max(Number(this.fiMonthlyExpenses) || 0, 0);
      return monthly * 12 * multiplier;
    }
    // default annual expenses
    const annual = Math.max(Number(this.fiAnnualExpenses) || 0, 0);
    return annual * multiplier;
  }

  toJSON() {
    return {
      accounts: this.accounts.map(acc => acc.toJSON()),
      actualValues: this.actualValues,
      projectionYears: this.projectionYears,
      taxRate: this.taxRate,
      baseCurrency: this.baseCurrency,
      fiMode: this.fiMode,
      fiMultiplier: this.fiMultiplier,
      fiAnnualExpenses: this.fiAnnualExpenses,
      fiMonthlyExpenses: this.fiMonthlyExpenses,
      fiValue: this.fiValue,
      birthdate: this.birthdate,
      projections: this.projections.map(proj => proj.toJSON()),
      activeProjectionId: this.activeProjectionId,
      transferRules: this.transferRules.map(rule => rule.toJSON()) // legacy fallback
    };
  }
}
