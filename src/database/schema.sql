-- Connect as sara to portfolio_manager database first
-- psql -U sara -d portfolio_manager -f schema.sql

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE portfolios (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  base_currency VARCHAR(3) DEFAULT 'USD',
  default_investment_yield DECIMAL(5,2) DEFAULT 7.0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  projection_years INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'investment' or 'cash'
  balance DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  yield_rate DECIMAL(5,2),
  interest_rate DECIMAL(5,2),
  taxable BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE transfer_rules (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  frequency VARCHAR(50) NOT NULL, -- 'monthly' or 'annual'
  from_external BOOLEAN DEFAULT false,
  from_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  external_amount DECIMAL(15,2),
  external_currency VARCHAR(3),
  amount_type VARCHAR(50) NOT NULL, -- 'fixed' or 'earnings'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE actual_values (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  year_index INTEGER NOT NULL,
  value DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, year_index)
);

CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_accounts_portfolio_id ON accounts(portfolio_id);
CREATE INDEX idx_transfer_rules_portfolio_id ON transfer_rules(portfolio_id);
CREATE INDEX idx_actual_values_account_id ON actual_values(account_id);