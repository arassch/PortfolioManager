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
    const projectionsFromData = (data.projections || []).map(p => new Projection(p));

    if (projectionsFromData.length > 0) {
      this.projections = projectionsFromData;
    } else {
      const legacyOverrides = {};
      this.accounts.forEach(acc => {
        legacyOverrides[acc.id] = {
          yield: acc.yield,
          interestRate: acc.interestRate
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
      return new Account({
        ...acc,
        yield: overrides.yield ?? acc.yield,
        interestRate: overrides.interestRate ?? acc.interestRate
      });
    });

    return {
      accounts,
      transferRules: projection.transferRules,
      actualValues: this.actualValues,
      projectionYears: this.projectionYears,
      taxRate: this.taxRate,
      baseCurrency: this.baseCurrency,
      getAccountById: (accountId) =>
        accounts.find(a => a.id == accountId || String(a.id) === String(accountId))
    };
  }

  toJSON() {
    return {
      accounts: this.accounts.map(acc => acc.toJSON()),
      actualValues: this.actualValues,
      projectionYears: this.projectionYears,
      taxRate: this.taxRate,
      baseCurrency: this.baseCurrency,
      projections: this.projections.map(proj => proj.toJSON()),
      activeProjectionId: this.activeProjectionId,
      transferRules: this.transferRules.map(rule => rule.toJSON()) // legacy fallback
    };
  }
}
