export const CURRENCIES = ['USD', 'GBP', 'EUR', 'JPY', 'CAD', 'AUD', 'CHF'];

// Fallback rates (approx) used if live lookup fails.
export const EXCHANGE_RATES = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.52,
  CHF: 0.88
};

export const CURRENCY_SYMBOLS = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  JPY: '¥',
  CAD: 'C$',
  AUD: 'A$',
  CHF: 'Fr'
};

export const ACCOUNT_TYPES = ['investment', 'cash', 'debt'];
export const FREQUENCIES = ['annual', 'monthly'];
export const AMOUNT_TYPES = ['fixed', 'earnings'];

export const DEFAULT_SETTINGS = {
  projectionYears: 10,
  taxRate: 25,
  baseCurrency: 'USD'
};
