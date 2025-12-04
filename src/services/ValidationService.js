/**
 * ValidationService - Validates portfolio data
 */
class ValidationService {
  validateAccount(account) {
    const errors = [];
    
    if (!account.name || account.name.trim() === '') {
      errors.push('Account name is required');
    }
    
    if (account.balance <= 0) {
      errors.push('Balance must be greater than 0');
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
    
    if (!rule.transfers || rule.transfers.length === 0) {
      errors.push('At least one transfer destination is required');
    }
    
    if (rule.transfers && !rule.transfers.every(t => t.toAccountId)) {
      errors.push('All transfer destinations must be selected');
    }
    
    if (rule.amountType === 'fixed' && rule.externalAmount <= 0) {
      errors.push('Amount must be greater than 0');
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