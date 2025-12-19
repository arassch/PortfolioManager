import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from '../constants/currencies';

/**
 * CurrencyService - Handles currency conversion and formatting
 */
class CurrencyService {
  constructor() {
    this.liveRates = { ...EXCHANGE_RATES };
    this.lastFetched = 0;
    this.refreshing = false;
    // Fire-and-forget refresh; conversion will fall back to defaults until fetched.
    this.refreshRates().catch(() => {});
  }

  async refreshRates() {
    console.log('CurrencyService: refreshing exchange rates...');
    if (this.refreshing) return;
    // Refresh at most every 6 hours
    const SIX_HOURS = 1000 * 60 * 60 * 6;
    if (Date.now() - this.lastFetched < SIX_HOURS) return;
    this.refreshing = true;
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=USD');
      if (!res.ok) throw new Error('Failed to fetch rates');
      const data = await res.json();
      if (data?.rates) {
        this.liveRates = data.rates;
        this.lastFetched = Date.now();
        console.log('CurrencyService: fetched live exchange rates', this.liveRates);
      }
    } catch (err) {
      // Keep existing rates on failure
      console.warn('CurrencyService: using fallback rates', err);
    } finally {
      this.refreshing = false;
    }
  }

  getRate(currency) {
    console.log('CurrencyService: getRate for', currency);
    if (!currency) return null;
    if (!this.refreshing) {
      // Start background refresh; don't await to keep API synchronous for callers.
      this.refreshRates().catch(() => {});
    }
    return this.liveRates?.[currency] ?? EXCHANGE_RATES[currency] ?? null;
  }

  convertToBase(amount, fromCurrency, baseCurrency = 'USD') {
    console.log('CurrencyService: convertToBase', amount, fromCurrency, '->', baseCurrency);
    if (!fromCurrency || !baseCurrency || fromCurrency === baseCurrency) {
      return Number(amount) || 0;
    }
    const fromRate = this.getRate(fromCurrency);
    const toRate = this.getRate(baseCurrency);
    if (!fromRate || !toRate) {
      // Fallback: no conversion if we don't know the rate
      return Number(amount) || 0;
    }
    // Convert to USD first (intermediate step)
    const toUSD = amount / fromRate;
    // Then convert from USD to base currency
    return toUSD * toRate;
  }

  convertFromBase(baseAmount, baseCurrency = 'USD', toCurrency) {
    console.log('CurrencyService: convertFromBase', baseAmount, baseCurrency, '->', toCurrency);
    const baseRate = this.getRate(baseCurrency);
    const targetRate = this.getRate(toCurrency);
    if (!baseRate || !targetRate) {
      return Number(baseAmount) || 0;
    }
    // Convert from base currency to USD first
    const fromUSD = baseAmount / baseRate;
    // Then convert from USD to target currency
    return fromUSD * targetRate;
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
