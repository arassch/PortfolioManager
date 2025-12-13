/**
 * ValidationService - Validates portfolio data
 */
class ValidationService {
  validateAccount(account) {
    const errors = [];
    
    if (!account.name || account.name.trim() === '') {
      errors.push('Account name is required');
    }
    
    if (account.balance < 0 || isNaN(account.balance)) {
      errors.push('Balance cannot be negative');
    }
    
    if (!account.currency) {
      errors.push('Currency is required');
    }
    
    return errors;
  }

  validateTransferRule(rule) {
    const errors = [];
    
    const hasSource = rule.fromAccountId || rule.fromExternal;
    if (!hasSource) {
      errors.push('Transfer source is required');
    }
    
    if (!rule.toAccountId && !rule.toExternal && !rule.external && rule.direction === 'internal') {
      errors.push('At least one transfer destination is required');
    }

    if (!rule.fromExternal && !rule.toExternal && rule.fromAccountId && rule.toAccountId && String(rule.fromAccountId) === String(rule.toAccountId)) {
      errors.push('Source and destination accounts cannot match');
    }
    
    if (rule.amountType === 'fixed' && rule.externalAmount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    if (rule.amountType === 'earnings') {
      if (rule.externalAmount <= 0 || rule.externalAmount > 100) {
        errors.push('Percentage of earnings must be between 1 and 100');
      }
    }

    if (!rule.startDate) errors.push('Start date is required');
    if (rule.frequency !== 'one_time') {
      if (!rule.frequency) errors.push('Frequency is required');
      if (rule.endDate && rule.startDate && rule.endDate < rule.startDate) {
        errors.push('End date cannot be before start date');
      }
    }

    if ((rule.toExternal || rule.external) && rule.direction === 'output' && !rule.externalTarget) {
      errors.push('Please provide a label for the external target');
    }
    
    return errors;
  }

  validatePortfolioSettings(settings) {
    const errors = [];
    
    if (settings.projectionYears < 1) {
      errors.push('Projection years must be at least 1');
    }
    
    if (settings.taxRate < 0 || settings.taxRate > 100) {
      errors.push('Tax rate must be between 0 and 100');
    }
    
    return errors;
  }
}

export default new ValidationService();
