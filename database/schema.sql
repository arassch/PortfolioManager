-- Connect as username to portfolio_manager database first
-- psql -U username -d portfolio_manager -f schema.sql

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT,
  revoked BOOLEAN DEFAULT FALSE,
  replaced_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);

CREATE TABLE revoked_jti (
  jti TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
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
  frequency VARCHAR(50), -- 'monthly' or 'annual'
  start_date DATE,
  end_date DATE,
  one_time_at DATE,
  from_external BOOLEAN DEFAULT false,
  from_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  to_external BOOLEAN DEFAULT false,
  external_target VARCHAR(255),
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
