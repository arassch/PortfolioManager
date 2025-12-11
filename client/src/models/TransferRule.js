/**
 * TransferRule model - represents an automated transfer rule
 */
export class TransferRule {
  constructor(data) {
    this.id = data.id || Date.now();
    this.fromAccountId = data.fromAccountId || '';
    this.fromExternal = data.fromExternal || false;
    const amount = parseFloat(data.externalAmount);
    this.externalAmount = isNaN(amount) ? 0 : amount;
    this.externalCurrency = data.externalCurrency || 'USD';
    this.toAccountId = data.toAccountId; 
    this.frequency = data.frequency || 'annual';
    this.amountType = data.amountType || 'fixed'; // 'fixed' or 'earnings'
    if (this.amountType === 'earnings' && (!this.externalAmount || this.externalAmount <= 0)) {
      this.externalAmount = 100; // default to 100% of earnings
    }
  }

  isValid() {
    const hasSource = this.fromAccountId || this.fromExternal;
    const hasDestination = this.toAccountId;
    return hasSource && hasDestination;
  }

  getAmount() {
    return this.externalAmount;
  }

  toJSON() {
    return {
      id: this.id,
      fromAccountId: this.fromAccountId,
      fromExternal: this.fromExternal,
      externalAmount: this.externalAmount,
      externalCurrency: this.externalCurrency,
      frequency: this.frequency,
      amountType: this.amountType,
      toAccountId: this.toAccountId
    };
  }
}
