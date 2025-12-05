import { Account } from '../models/Account';
import ValidationService from '../services/ValidationService';

/**
 * AccountController - Manages account operations
 */
class AccountController {
  createAccount(accountData, accounts) {
    const account = new Account(accountData);
    
    const errors = ValidationService.validateAccount(account);
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
    
    return [...accounts, account];
  }

  updateAccount(accountId, field, value, accounts) {
    return accounts.map(acc =>
      acc.id === accountId ? { ...acc, [field]: value } : acc
    );
  }

  deleteAccount(accountId, accounts, transferRules) {
    const updatedAccounts = accounts.filter(acc => acc.id !== accountId);
    
    // Clean up transfer rules that reference this account
    const updatedRules = transferRules.filter(rule =>
      rule.fromAccountId !== accountId &&
      rule.toAccountId !== accountId
    );
    
    return { accounts: updatedAccounts, transferRules: updatedRules };
  }

  getAccountById(accountId, accounts) {
    return accounts.find(acc => acc.id == accountId || String(acc.id) === String(accountId));
  }
}

export default new AccountController();
