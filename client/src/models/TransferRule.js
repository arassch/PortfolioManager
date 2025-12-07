/**
 * TransferRule model - represents an automated transfer rule
 */
export class TransferRule {
  constructor(data) {
    this.id = data.id || Date.now();
    this.fromAccountId = data.fromAccountId || '';
    this.fromExternal = data.fromExternal || false;
    this.externalAmount = parseFloat(data.externalAmount) || 0;
    this.externalCurrency = data.externalCurrency || 'USD';
    this.toAccountId = data.toAccountId; 
    this.frequency = data.frequency || 'annual'; // 'annual' or 'monthly'
    this.amountType = data.amountType || 'fixed'; // 'fixed' or 'earnings'
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