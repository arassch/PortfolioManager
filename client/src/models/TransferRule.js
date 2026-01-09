/**
 * TransferRule model - represents an automated transfer rule
 */
export class TransferRule {
  constructor(data) {
    this.id = data.id || Date.now();
    this.fromAccountId = data.fromAccountId || '';
    this.fromExternal = data.fromExternal || false;
    this.toExternal = data.toExternal || false;
    this.external = data.external || false; // UI convenience flag
    this.direction = data.direction || 'output'; // 'input' | 'output'
    this.externalTarget = data.externalTarget || '';
    const amount = parseFloat(data.externalAmount);
    this.externalAmount = isNaN(amount) ? 0 : amount;
    this.externalCurrency = data.externalCurrency || 'USD';
    this.toAccountId = data.toAccountId; 
    this.frequency = data.frequency || 'annual'; // 'annual' | 'monthly' | 'one_time' | 'every_x_years'
    this.intervalYears = this.frequency === 'every_x_years'
      ? Math.max(1, parseInt(data.intervalYears ?? data.repeatEveryYears ?? data.everyXYears, 10) || 1)
      : null;
    this.startDate = data.startDate || '';
    this.endDate = data.endDate || '';
    this.startMilestoneId = data.startMilestoneId || null;
    this.endMilestoneId = data.endMilestoneId || null;
    this.amountType = data.amountType || 'fixed'; // 'fixed' or 'earnings'
    if (this.amountType === 'earnings' && (!this.externalAmount || this.externalAmount <= 0)) {
      this.externalAmount = 100; // default to 100% of earnings
    }

    // Derive legacy flags from external/direction
    if (this.external) {
      if (this.direction === 'input') {
        this.fromExternal = true;
        this.toExternal = false;
      } else {
        this.fromExternal = false;
        this.toExternal = true;
      }
    }
  }

  isValid() {
    const hasSource = this.fromAccountId || this.fromExternal;
    const hasDestination = this.toAccountId || this.toExternal;
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
      toExternal: this.toExternal,
      externalTarget: this.externalTarget,
      externalAmount: this.externalAmount,
      externalCurrency: this.externalCurrency,
      frequency: this.frequency,
      intervalYears: this.intervalYears,
      startDate: this.startDate,
      startMilestoneId: this.startMilestoneId,
      endDate: this.endDate,
      endMilestoneId: this.endMilestoneId,
      amountType: this.amountType,
      toAccountId: this.toAccountId,
      external: this.external,
      direction: this.direction
    };
  }
}
