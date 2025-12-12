import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from '../constants/currencies';

/**
 * CurrencyService - Handles currency conversion and formatting
 */
class CurrencyService {
  convertToBase(amount, fromCurrency, baseCurrency = 'USD') {
    if (!fromCurrency || !baseCurrency || fromCurrency === baseCurrency) {
      return Number(amount) || 0;
    }
    if (!EXCHANGE_RATES[fromCurrency] || !EXCHANGE_RATES[baseCurrency]) {
      // Fallback: no conversion if we don't know the rate
      return Number(amount) || 0;
    }
    // Convert to USD first (intermediate step)
    const toUSD = amount / EXCHANGE_RATES[fromCurrency];
    // Then convert from USD to base currency
    return toUSD * EXCHANGE_RATES[baseCurrency];
  }

  convertFromBase(baseAmount, baseCurrency = 'USD', toCurrency) {
    // Convert from base currency to USD first
    const fromUSD = baseAmount / EXCHANGE_RATES[baseCurrency];
    // Then convert from USD to target currency
    return fromUSD * EXCHANGE_RATES[toCurrency];
  }

  getSymbol(currency) {
    return CURRENCY_SYMBOLS[currency] || currency;
  }

  formatCurrency(amount, currency, options = {}) {
    const symbol = this.getSymbol(currency);
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) {
      return `${symbol}—`;
    }
    const formatted = numeric.toLocaleString(undefined, {
      minimumFractionDigits: options.decimals ?? 0,
      maximumFractionDigits: options.decimals ?? 0,
      ...options
    });
    return `${symbol}${formatted}`;
  }
}

export default new CurrencyService();
