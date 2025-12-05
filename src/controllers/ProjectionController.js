import CurrencyService from '../services/CurrencyService';

/**
 * ProjectionController - Manages projection calculations
 */
class ProjectionController {
  calculateProjections(portfolio, selectedAccounts, showIndividualAccounts) {
    const data = [];

    if (!portfolio || !portfolio.accounts) {
      return data;
    }

    const currentYear = new Date().getFullYear();
    
    const accountBalances = {};
    portfolio.accounts.forEach(account => {
      accountBalances[account.id] = CurrencyService.convertToBase(
        account.balance, 
        account.currency,
        portfolio.baseCurrency
      );
    });

    for (let yearIndex = 0; yearIndex <= portfolio.projectionYears; yearIndex++) {
      const year = currentYear + yearIndex;
      const yearData = {
        year,
        label: year.toString(),
        projected: 0,
        totalYield: 0,
        actual: null
      };

      let totalProjected = 0;
      let totalYieldForYear = 0;
      let totalActual = 0;

      // Store start of year balances
      const yearStartBalances = {};
      portfolio.accounts.forEach(account => {
        yearStartBalances[account.id] = accountBalances[account.id];
      });

      // ONLY apply growth if yearIndex > 0 (Year 0 is current snapshot)
      if (yearIndex > 0) {
        // Simulate 12 months of growth
        for (let month = 1; month <= 12; month++) {
          portfolio.accounts.forEach(account => {
            const rate = account.getYieldRate() || portfolio.defaultInvestmentYield;
            const monthlyRate = rate / 100 / 12;
            accountBalances[account.id] *= (1 + monthlyRate);
          });

          // Apply monthly transfers
          portfolio.transferRules.forEach(rule => {
            if (rule.frequency === 'monthly') {
              this.applyTransfer(
                rule,
                portfolio,
                accountBalances,
                yearStartBalances,
                12,
                portfolio.baseCurrency
              );
            }
          });
        }

        // Apply annual transfers at year end
        portfolio.transferRules.forEach(rule => {
          if (rule.frequency === 'annual') {
            this.applyTransfer(
              rule,
              portfolio,
              accountBalances,
              yearStartBalances,
              1,
              portfolio.baseCurrency
            );
          }
        });

        // Apply taxes
        portfolio.accounts.forEach(account => {
          if (account.taxable) {
            const originalBalance = CurrencyService.convertToBase(
              account.balance,
              account.currency,
              portfolio.baseCurrency
            );
            const currentBalance = accountBalances[account.id];

            if (currentBalance > originalBalance) {
              const gain = currentBalance - originalBalance;
              const tax = gain * (portfolio.taxRate / 100);
              accountBalances[account.id] -= tax;
            }
          }
        });
      }

      // Calculate totals for this year
      portfolio.accounts.forEach(account => {
        const isSelected = selectedAccounts[account.id];

        if (!isSelected) return;

        const value = accountBalances[account.id];

        totalProjected += value;

        if (yearIndex > 0) {
          const annualYield = value - yearStartBalances[account.id];
          totalYieldForYear += annualYield;

          if (showIndividualAccounts) {
            yearData[`account_${account.id}_yield`] = Math.round(annualYield);
          }
        } else if (showIndividualAccounts) {
          yearData[`account_${account.id}_yield`] = 0;
        }

        if (showIndividualAccounts) {
          yearData[`account_${account.id}`] = Math.round(value);
        }

        if (portfolio.actualValues[account.id]?.[yearIndex]) {
          totalActual += CurrencyService.convertToBase(
            portfolio.actualValues[account.id][yearIndex],
            account.currency,
            portfolio.baseCurrency
          );
        }
      });

      yearData.projected = Math.round(totalProjected);
      yearData.totalYield = Math.round(totalYieldForYear);
      yearData.actual = totalActual > 0 ? Math.round(totalActual) : null;

      data.push(yearData);
    }

    return data;
  }

  applyTransfer(rule, portfolio, accountBalances, yearStartBalances, divisor, baseCurrency) {
    let availableAmount = 0;

    if (rule.fromExternal) {
      availableAmount = CurrencyService.convertToBase(
        rule.externalAmount,
        rule.externalCurrency,
        baseCurrency
      ) / divisor;
    } else {
      const fromAccount = portfolio.getAccountById(rule.fromAccountId);
      if (!fromAccount) return;

      if (rule.amountType === 'earnings') {
        const monthlyGrowth = 
          accountBalances[rule.fromAccountId] - yearStartBalances[rule.fromAccountId];
        availableAmount = monthlyGrowth / divisor;
      } else {
        availableAmount = CurrencyService.convertToBase(
          rule.externalAmount || 0,
          fromAccount.currency,
          baseCurrency
        ) / divisor;
      }
    }

    const toAccountId = rule.toAccountId;
    if (!toAccountId || accountBalances[toAccountId] === undefined) {
      return;
    }

    if (!rule.fromExternal && rule.fromAccountId) {
      accountBalances[rule.fromAccountId] -= availableAmount;
    }
    accountBalances[toAccountId] += availableAmount;
  }
}

export default new ProjectionController();
