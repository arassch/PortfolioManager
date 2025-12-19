import CurrencyService from '../services/CurrencyService';

/**
 * ProjectionController - Manages projection calculations
 */
const TIME_TRAVEL_YEARS = Math.max(0, Math.floor(Number(import.meta.env.VITE_TIME_TRAVEL_YEARS || 0)));

class ProjectionController {
  calculateProjections(portfolio, selectedAccounts, showIndividualAccounts) {
    const data = [];

    if (!portfolio || !portfolio.accounts) {
      return data;
    }

    const currentYear = new Date().getFullYear();
    const offsetYears = TIME_TRAVEL_YEARS;
    const taxRate = portfolio.taxRate || 0;
    const transferRules = portfolio.transferRules || [];
    const inflation = portfolio.inflationRate ?? 0;

    // Build actuals by absolute year (with legacy offset support)
    const actualTotalsByYear = {};
    const actualByAccountYear = {};
    portfolio.accounts.forEach(account => {
      const entries = portfolio.actualValues[account.id] || {};
      const isSelected = selectedAccounts[account.id] !== false; // default to included when not specified
      Object.entries(entries).forEach(([key, val]) => {
        const numKey = Number(key);
        const yearValue = numKey >= 1900 ? numKey : currentYear + numKey;
        if (!isSelected) return;
        const baseVal = CurrencyService.convertToBase(val, account.currency, portfolio.baseCurrency);
        actualTotalsByYear[yearValue] = (actualTotalsByYear[yearValue] || 0) + baseVal;
        if (!actualByAccountYear[yearValue]) actualByAccountYear[yearValue] = {};
        actualByAccountYear[yearValue][account.id] = baseVal;
      });
    });

    const minActualYear = Object.keys(actualTotalsByYear)
      .map(Number)
      .filter(y => !Number.isNaN(y) && y < currentYear)
      .sort((a, b) => a - b)[0];

    // Past actuals only entries
    if (minActualYear !== undefined) {
      for (let y = minActualYear; y < currentYear; y++) {
        const yearData = {
          year: y,
          label: y.toString(),
          projected: null,
        totalReturn: 0,
          actual: actualTotalsByYear[y] ? Math.round(actualTotalsByYear[y]) : null
        };
        if (actualByAccountYear[y]) {
          Object.entries(actualByAccountYear[y]).forEach(([accId, val]) => {
            const rounded = Math.round(val);
            yearData[`account_${accId}`] = rounded;
            yearData[`account_${accId}_actual`] = rounded;
            yearData[`account_${accId}_observed`] = rounded;
          });
        }
        data.push(yearData);
      }
    }

    const accountBalances = {};
    const accountBasis = {};
    portfolio.accounts.forEach(account => {
      const balanceBase = CurrencyService.convertToBase(
        account.balance,
        account.currency,
        portfolio.baseCurrency
      );
      accountBalances[account.id] = balanceBase;
      const basisBase = CurrencyService.convertToBase(
        account.costBasis || account.balance,
        account.currency,
        portfolio.baseCurrency
      );
      accountBasis[account.id] = basisBase;
    });

    const totalYears = portfolio.projectionYears + offsetYears;

    for (let yearIndex = 0; yearIndex <= totalYears; yearIndex++) {
      const year = currentYear + yearIndex;
      const yearData = {
        year,
        label: year.toString(),
        projected: 0,
        totalReturn: 0,
        actual: null
      };

      let totalProjected = 0;
      let totalReturnForYear = 0;
      let totalProjectedAfterTaxRounded = 0;
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
        transferRules
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
            const nominalAnnual = ((account.getReturnRate?.() ?? account.returnRate ?? 0)) / 100;
            const inflationAnnual = (portfolio.inflationRate ?? 0) / 100;
            // Fisher equation for real annual rate
            const realAnnual = ((1 + nominalAnnual) / (1 + inflationAnnual)) - 1;
            // Convert annual real rate to equivalent monthly rate
            const monthlyRate = Math.pow(1 + realAnnual, 1 / 12) - 1;
            // If this account sends earnings away, base gains on start-of-year balance (no compounding)
            const gainBase = earningsTransferAccounts.has(account.id)
              ? yearStartBalances[account.id]
              : accountBalances[account.id];
            const grossGain = gainBase * monthlyRate;
            // Compound pre-tax; taxes handled separately in after-tax view
            const netGain = grossGain;
            accountBalances[account.id] += netGain;
            monthNetGain[account.id] = netGain;
            yearNetGains[account.id] += netGain;
          });

          // Apply monthly transfers
      transferRules.forEach(rule => {
        if (this.shouldApplyRule(rule, year, month, true)) {
          this.applyTransfer(
            rule,
            portfolio,
            accountBalances,
            monthNetGain,
            transferTotals,
            portfolio.baseCurrency,
            taxRate,
            accountBasis
          );
        }
      });

          // Update month starting balances after transfers
          portfolio.accounts.forEach(account => {
            monthStartBalances[account.id] = accountBalances[account.id];
          });
        }

        // Apply annual transfers at year end
        const annualMonth = 12;
        transferRules.forEach(rule => {
          if (this.shouldApplyRule(rule, year, annualMonth, false)) {
            this.applyTransfer(
              rule,
              portfolio,
              accountBalances,
              yearNetGains,
              transferTotals,
              portfolio.baseCurrency,
              taxRate,
              accountBasis
            );
          }
        });

      }

      // Calculate totals for this year
      portfolio.accounts.forEach(account => {
        const isSelected = selectedAccounts[account.id] !== false; // default to selected

        if (!isSelected) return;

        const value = accountBalances[account.id];
        const effectiveTreatment = account.taxable ? 'taxable' : 'roth';
        const afterTax = this.calculateAfterTaxValue(
          value,
          accountBasis[account.id],
          effectiveTreatment,
          taxRate
        );
        const afterTaxRounded = Math.round(afterTax);

        totalProjected += value;
        totalProjectedAfterTaxRounded += afterTaxRounded;

        if (yearIndex > 0) {
          const annualReturn = value - yearStartBalances[account.id];
          totalReturnForYear += annualReturn;
          yearData[`account_${account.id}_return`] = Math.round(annualReturn);
        } else {
          yearData[`account_${account.id}_return`] = 0;
        }

        const projectedRounded = Math.round(value);
        let observedVal = null;
        yearData[`account_${account.id}`] = projectedRounded;
        if (yearIndex === 0) {
          observedVal = projectedRounded; // initial balance counts as an observed point
        }
        if (yearIndex > 0 && account.taxable) {
          yearData[`account_${account.id}_net`] = afterTaxRounded;
        }
        yearData[`account_${account.id}_transfers`] = Math.round(transferTotals[account.id] || 0);

        const actualForYear =
          portfolio.actualValues[account.id]?.[year] ??
          portfolio.actualValues[account.id]?.[yearIndex]; // support legacy index-based data
        if (actualForYear !== undefined) {
          const actualBase = CurrencyService.convertToBase(
            actualForYear,
            account.currency,
            portfolio.baseCurrency
          );
          totalActual += actualBase;
          const roundedActual = Math.round(actualBase);
          yearData[`account_${account.id}_actual`] = roundedActual;
          observedVal = roundedActual; // actual datapoint
        }

        yearData[`account_${account.id}_observed`] = observedVal;
      });

      yearData.projected = Math.round(totalProjected);
      const totalTaxRounded = Math.max(yearData.projected - totalProjectedAfterTaxRounded, 0);
      yearData.projectedNet = (yearIndex === 0 || totalTaxRounded === 0) ? null : totalProjectedAfterTaxRounded;
      yearData.totalReturn = Math.round(totalReturnForYear);
      yearData.actual = totalActual > 0 ? Math.round(totalActual) : null;

      data.push(yearData);
    }

    return data;
  }

  shouldApplyRule(rule, year, month, isMonthlyPhase) {
    const dateToCheck = new Date(year, month - 1, 1);
    const isOneTime = rule.frequency === 'one_time';
    if (isOneTime) {
      if (!rule.startDate) return false;
      const one = new Date(rule.startDate);
      return one.getFullYear() === year && one.getMonth() + 1 === month;
    }

    const freqMatch = isMonthlyPhase
      ? rule.frequency === 'monthly'
      : rule.frequency === 'annual';

    if (rule.startDate) {
      const start = new Date(rule.startDate);
      if (dateToCheck < start) return false;
    }
    if (rule.endDate) {
      const end = new Date(rule.endDate);
      if (dateToCheck > end) return false;
    }
    return freqMatch;
  }

  applyTransfer(rule, portfolio, accountBalances, periodGrowth, transferTotals, baseCurrency, taxRate, accountBasis) {
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
        const pct = rule.externalAmount > 0 ? Math.min(rule.externalAmount, 100) : 100;
        availableAmount = growth > 0 ? growth * (pct / 100) : 0;
      } else {
        availableAmount = CurrencyService.convertToBase(
          rule.externalAmount || 0,
          fromAccount.currency,
          baseCurrency
        );
      }
    }

    const toAccountId = rule.toAccountId;
    if (!toAccountId && !rule.toExternal && accountBalances[toAccountId] === undefined) {
      return;
    }

    let netOut = availableAmount;
    let basisMoved = 0;

    if (!rule.fromExternal && rule.fromAccountId) {
      // Move basis proportionally when transferring between accounts; apply tax on gains if taxable
      const fromValue = accountBalances[rule.fromAccountId];
      const fromBasis = accountBasis[rule.fromAccountId] || 0;
      const proportion = fromValue > 0 ? Math.min(1, availableAmount / fromValue) : 1;
      basisMoved = fromBasis * proportion;
      const gainPortion = Math.max(availableAmount - basisMoved, 0);
      const fromAccount = portfolio.getAccountById(rule.fromAccountId);
      const taxableRate = fromAccount?.taxable ? (taxRate / 100) : 0;
      const tax = gainPortion * taxableRate;
      netOut = Math.max(availableAmount - tax, 0);
      accountBalances[rule.fromAccountId] -= (netOut + tax);
      accountBasis[rule.fromAccountId] = Math.max(0, fromBasis - basisMoved);
      transferTotals[rule.fromAccountId] = (transferTotals[rule.fromAccountId] || 0) - netOut - tax;
    } else if (rule.fromExternal) {
      // External contribution increases basis on the target
      basisMoved = availableAmount;
    }

    if (rule.toExternal) {
      // outbound only; no destination balance
      return;
    }

    accountBalances[toAccountId] += netOut;
    transferTotals[toAccountId] = (transferTotals[toAccountId] || 0) + netOut;
    accountBasis[toAccountId] = (accountBasis[toAccountId] || 0) + basisMoved;
  }

  calculateAfterTaxValue(currentValue, costBasis, taxTreatment, taxRate) {
    const rate = (taxRate || 0) / 100;
    if (taxTreatment === 'roth') return currentValue;
    if (taxTreatment === 'deferred') return currentValue * (1 - rate);
    // taxable: apply cap-gains style haircut on embedded gains
    const basis = Math.max(costBasis || 0, 0);
    const embeddedGain = Math.max(currentValue - basis, 0);
    return currentValue - embeddedGain * rate;
  }
}

export default new ProjectionController();
