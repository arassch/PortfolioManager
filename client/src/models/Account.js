/**
 * Account model - represents a single account in the portfolio
 */
export class Account {
  constructor(data) {
    this.id = data.id || Date.now();
    this.name = data.name;
    this.type = data.type || 'investment'; // 'investment' or 'cash'
    this.balance = parseFloat(data.balance) || 0;
    this.currency = data.currency || 'USD';
    this.returnRate = parseFloat(data.returnRate ?? 0) || 0;
    // Tax treatment/basis for after-tax views
    this.taxTreatment = data.taxTreatment ?? (data.taxable ? 'taxable' : 'roth'); // 'taxable' | 'deferred' | 'roth'
    this.costBasis = Number.isFinite(parseFloat(data.costBasis)) ? parseFloat(data.costBasis) : this.balance; // starting principal/basis
  }

  isValid() {
    return this.name && this.balance >= 0 && this.currency;
  }

  getReturnRate() {
    return this.returnRate;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      balance: this.balance,
      currency: this.currency,
      returnRate: this.returnRate,
      taxTreatment: this.taxTreatment,
      costBasis: this.costBasis
    };
  }
}
