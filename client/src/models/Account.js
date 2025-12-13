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
    this.interestRate = parseFloat(data.interestRate) || 0; // for cash accounts
    this.yield = parseFloat(data.yield) || 0; // for investment accounts
    this.taxable = data.taxable || false;
    // Tax treatment/basis for after-tax views
    this.taxTreatment = data.taxTreatment || (this.taxable ? 'taxable' : 'deferred'); // 'taxable' | 'deferred' | 'roth'
    this.costBasis = parseFloat(data.costBasis) || this.balance; // starting principal/basis
  }

  isValid() {
    return this.name && this.balance >= 0 && this.currency;
  }

  getYieldRate() {
    return this.type === 'cash' ? this.interestRate : this.yield;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      balance: this.balance,
      currency: this.currency,
      interestRate: this.interestRate,
      yield: this.yield,
      taxable: this.taxable,
      taxTreatment: this.taxTreatment,
      costBasis: this.costBasis
    };
  }
}
