import { TransferRule } from './TransferRule';

/**
 * Projection model - scenario-specific settings and rules
 */
export class Projection {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.name = data.name || 'Projection';
    this.inflationRate = parseFloat(data.inflationRate ?? 0) || 0;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.transferRules = (data.transferRules || []).map(rule => new TransferRule(rule));
    this.milestones = (data.milestones || []).map(m => ({
      id: m.id ?? Date.now(),
      label: m.label || 'Milestone',
      year: Number(m.year) || new Date().getFullYear(),
      sortOrder: m.sortOrder != null ? m.sortOrder : 0
    }));
    const overrides = data.accountOverrides || {};
    this.accountOverrides = Object.fromEntries(
      Object.entries(overrides).map(([accId, override]) => {
        const rate = override.returnRate ?? 0;
        return [accId, { returnRate: rate }];
      })
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      inflationRate: this.inflationRate,
      createdAt: this.createdAt,
      transferRules: this.transferRules.map(rule => rule.toJSON()),
      accountOverrides: this.accountOverrides,
      milestones: this.milestones
    };
  }
}
