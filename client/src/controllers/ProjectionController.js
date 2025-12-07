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

      // Track transfers applied this year for tooltip/debug purposes
      const transferTotals = {};
      const yearNetGains = {};
      portfolio.accounts.forEach(acc => { yearNetGains[acc.id] = 0; });

      // Accounts whose earnings are sent away (no compounding on balance)
      const earningsTransferAccounts = new Set(
        portfolio.transferRules
          .filter(r => r.amountType === 'earnings' && !r.fromExternal && r.fromAccountId)
          .map(r => r.fromAccountId)
      );

      // ONLY apply growth if yearIndex > 0 (Year 0 is current snapshot)
      if (yearIndex > 0) {
        // Simulate 12 months of growth
        const monthStartBalances = { ...accountBalances };
        for (let month = 1; month <= 12; month++) {
          const monthNetGain = {};
          portfolio.accounts.forEach(account => {
            const rate = account.getYieldRate() || portfolio.defaultInvestmentYield;
            const monthlyRate = rate / 100 / 12;
            // If this account sends earnings away, base gains on start-of-year balance (no compounding)
            const gainBase = earningsTransferAccounts.has(account.id)
              ? yearStartBalances[account.id]
              : accountBalances[account.id];
            const grossGain = gainBase * monthlyRate;
            const tax = account.taxable && grossGain > 0
              ? grossGain * (portfolio.taxRate / 100)
              : 0;
            const netGain = grossGain - tax;
            accountBalances[account.id] += netGain;
            monthNetGain[account.id] = netGain;
            yearNetGains[account.id] += netGain;
          });

          // Apply monthly transfers
          portfolio.transferRules.forEach(rule => {
            if (rule.frequency === 'monthly') {
              this.applyTransfer(
                rule,
                portfolio,
                accountBalances,
                monthNetGain,
                transferTotals,
                portfolio.baseCurrency,
                portfolio.taxRate
              );
            }
          });

          // Update month starting balances after transfers
          portfolio.accounts.forEach(account => {
            monthStartBalances[account.id] = accountBalances[account.id];
          });
        }

        // Apply annual transfers at year end
        portfolio.transferRules.forEach(rule => {
          if (rule.frequency === 'annual') {
            this.applyTransfer(
              rule,
              portfolio,
              accountBalances,
              yearNetGains,
              transferTotals,
              portfolio.baseCurrency,
              portfolio.taxRate
            );
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
          yearData[`account_${account.id}_transfers`] = Math.round(transferTotals[account.id] || 0);
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

  applyTransfer(rule, portfolio, accountBalances, periodGrowth, transferTotals, baseCurrency, taxRate) {
    let availableAmount = 0;

    if (rule.fromExternal) {
      availableAmount = CurrencyService.convertToBase(
        rule.externalAmount,
        rule.externalCurrency,
        baseCurrency
      );
    } else {
      const fromAccount = portfolio.getAccountById(rule.fromAccountId);
      if (!fromAccount) return;

      if (rule.amountType === 'earnings') {
        const growth = periodGrowth[rule.fromAccountId] || 0; // already net of tax
        availableAmount = growth > 0 ? growth : 0;
      } else {
        availableAmount = CurrencyService.convertToBase(
          rule.externalAmount || 0,
          fromAccount.currency,
          baseCurrency
        );
      }
    }

    const toAccountId = rule.toAccountId;
    if (!toAccountId || accountBalances[toAccountId] === undefined) {
      return;
    }

    if (!rule.fromExternal && rule.fromAccountId) {
      accountBalances[rule.fromAccountId] -= availableAmount;
      transferTotals[rule.fromAccountId] = (transferTotals[rule.fromAccountId] || 0) - availableAmount;
    }
    accountBalances[toAccountId] += availableAmount;
    transferTotals[toAccountId] = (transferTotals[toAccountId] || 0) + availableAmount;
  }
}

export default new ProjectionController();
