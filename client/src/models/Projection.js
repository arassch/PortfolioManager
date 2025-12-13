import { TransferRule } from './TransferRule';

/**
 * Projection model - scenario-specific settings and rules
 */
export class Projection {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.name = data.name || 'Projection';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.transferRules = (data.transferRules || []).map(rule => new TransferRule(rule));
    this.accountOverrides = data.accountOverrides || {};
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      createdAt: this.createdAt,
      transferRules: this.transferRules.map(rule => rule.toJSON()),
      accountOverrides: this.accountOverrides
    };
  }
}
