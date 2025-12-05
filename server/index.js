import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';

const { Pool } = pkg;
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], // Add your frontend origins
  credentials: true,
}));

// Custom CORS headers for all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
  next();
});

// Parse JSON bodies (for POST, etc.)
app.use(express.json({
  // Add an error handler directly to the JSON parser middleware
  verify: (req, res, buf, encoding) => {
    console.log('Verifying JSON body...');
    try {
      JSON.parse(buf);
    } catch (e) {
      console.error('Invalid JSON received:', buf.toString(encoding));
      res.status(400).send('Invalid JSON');
      throw new Error('Invalid JSON');
    }
  }
}));


// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'portfolio_user',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'portfolio_manager',
});

const normalizeAccount = (row) => ({
  id: row.id,
  portfolioId: row.portfolio_id,
  name: row.name,
  type: row.type,
  balance: Number(row.balance),
  currency: row.currency,
  yield: Number(row.yield_rate || 0),
  interestRate: Number(row.interest_rate || 0),
  taxable: row.taxable,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected:', res.rows[0]);
  }
});

// Wrapper for async routes to catch errors and pass them to Express's error handler
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Routes
app.get('/api/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get portfolio
    const portfolioRes = await pool.query(
      'SELECT * FROM portfolios WHERE user_id = $1',
      [userId]
    );
    
    if (portfolioRes.rows.length === 0) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    const portfolio = portfolioRes.rows[0];
    
    // Get accounts
    const accountsRes = await pool.query(
      'SELECT * FROM accounts WHERE portfolio_id = $1',
      [portfolio.id]
    );
    
    // Get transfer rules
    const rulesRes = await pool.query(
      'SELECT * FROM transfer_rules WHERE portfolio_id = $1',
      [portfolio.id]
    );
    const transferRules = rulesRes.rows.map(rule => ({
      id: rule.id,
      portfolioId: rule.portfolio_id,
      fromExternal: rule.from_external,
      fromAccountId: rule.from_account_id,
      toAccountId: rule.to_account_id,
      frequency: rule.frequency,
      externalAmount: Number(rule.external_amount || 0),
      externalCurrency: rule.external_currency,
      amountType: rule.amount_type
    }));
    
    // Get actual values
    const actualRes = await pool.query(
      'SELECT * FROM actual_values WHERE account_id = ANY($1)',
      [accountsRes.rows.map(a => a.id)]
    );
    
  const actualValues = {};
  actualRes.rows.forEach(row => {
    if (!actualValues[row.account_id]) {
      actualValues[row.account_id] = {};
    }
    actualValues[row.account_id][row.year_index] = Number(row.value);
  });
  
  res.json({
    id: portfolio.id,
    userId: portfolio.user_id,
    baseCurrency: portfolio.base_currency,
    defaultInvestmentYield: portfolio.default_investment_yield,
    taxRate: portfolio.tax_rate,
    projectionYears: portfolio.projection_years,
    accounts: accountsRes.rows.map(normalizeAccount),
    transferRules,
    actualValues
  });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    // Ensure CORS headers are on error responses too
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
});

app.post('/api/portfolio/:userId', asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { accounts = [], transferRules = [], actualValues = {}, ...portfolioSettings } = req.body;

    console.log('Saving portfolio for user: 1', userId);
    console.log('Portfolio settings:', accounts, transferRules, actualValues, portfolioSettings);
    
    const client = await pool.connect();
    try {
    console.log('Saving portfolio for user: 2', userId);
      await client.query('BEGIN');

      console.log('Saving portfolio for user: 3', userId);

      // Ensure user exists (placeholder email for now)
      const fallbackEmail = `user-${userId}@example.com`;
      await client.query(
        'INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email',
        [userId, portfolioSettings.userEmail || fallbackEmail]
      );
      
    console.log('Saving portfolio for user: 4', userId);

      // Upsert portfolio
      const portfolioRes = await client.query(
        `INSERT INTO portfolios (user_id, base_currency, default_investment_yield, tax_rate, projection_years)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO UPDATE SET
           base_currency = EXCLUDED.base_currency,
           default_investment_yield = EXCLUDED.default_investment_yield,
           tax_rate = EXCLUDED.tax_rate,
           projection_years = EXCLUDED.projection_years,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          userId,
          portfolioSettings.baseCurrency,
          portfolioSettings.defaultInvestmentYield,
          portfolioSettings.taxRate,
          portfolioSettings.projectionYears,
        ]
      );
    console.log('Saving portfolio for user: 5', userId);
      const portfolioId = portfolioRes.rows[0].id;
    console.log('Saving portfolio for user: 6', userId);

      // Clear old data
      await client.query('DELETE FROM transfer_rules WHERE portfolio_id = $1', [portfolioId]);
    console.log('Saving portfolio for user: 7', userId);
      // Also delete actual_values linked to the accounts being deleted
      await client.query('DELETE FROM actual_values WHERE account_id IN (SELECT id FROM accounts WHERE portfolio_id = $1)', [portfolioId]);
    console.log('Saving portfolio for user: 8', userId);
      await client.query('DELETE FROM accounts WHERE portfolio_id = $1', [portfolioId]);
    console.log('Saving portfolio for user: 9', userId);

      // Insert accounts and get their new IDs
      const accountIdMap = new Map();
      for (const account of accounts) {
        const accountRes = await client.query(
          `INSERT INTO accounts (portfolio_id, name, type, balance, currency, yield_rate, interest_rate, taxable)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            portfolioId, account.name, account.type, account.balance,
            account.currency, account.yield ?? account.yieldRate ?? 0,
            account.interestRate ?? 0, account.taxable
          ]
        );
        // Map old temporary ID to new database ID
        accountIdMap.set(String(account.id), accountRes.rows[0].id);
      }
    console.log('Saving portfolio for user: 10', userId);

      // Insert transfer rules with new account IDs
      for (const rule of transferRules) {
        const fromAccountId = rule.fromExternal
          ? null
          : (rule.fromAccountId ? accountIdMap.get(String(rule.fromAccountId)) : null);
        const toAccountId = accountIdMap.get(String(rule.toAccountId));
        if (!toAccountId) {
          throw new Error(`Unknown destination account id ${rule.toAccountId}`);
        }

        const ruleRes = await client.query(
          `INSERT INTO transfer_rules (portfolio_id, frequency, from_external, from_account_id, to_account_id, external_amount, external_currency, amount_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            portfolioId, rule.frequency, rule.fromExternal, fromAccountId, toAccountId,
            rule.externalAmount, rule.externalCurrency, rule.amountType
          ]
        );
        const ruleId = ruleRes.rows[0].id;
      }

      // Upsert actual values against the remapped account IDs
      for (const [accountId, valuesByYear] of Object.entries(actualValues)) {
        const dbAccountId = accountIdMap.get(String(accountId));
        if (!dbAccountId) {
          throw new Error(`Unknown account id ${accountId} for actual values`);
        }

        for (const [yearIndex, value] of Object.entries(valuesByYear || {})) {
          await client.query(
            `INSERT INTO actual_values (account_id, year_index, value)
             VALUES ($1, $2, $3)
             ON CONFLICT (account_id, year_index)
             DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [dbAccountId, Number(yearIndex), value]
          );
        }
      }

      await client.query('COMMIT');
      client.release();
      res.json({ success: true, portfolioId });
    } catch (e) {
      console.error('Database transaction failed:', e); // Log the original error immediately
      await client.query('ROLLBACK');
      client.release();
      return next(e); // Correctly pass the error to Express's error handling chain
    }
}));

// GET /api/seed -> create table if needed + ensure row id=1 exists
app.get('/api/seed', async (req, res) => {
  try {

    const client = await pool.connect();
    await client.query('BEGIN');

    // Create user if doesn't exist
    await client.query(
      "INSERT INTO users (id, email) VALUES (1, 'test@example.com') ON CONFLICT (id) DO NOTHING"
    );
    
    const userId = 1;
    
    // Create portfolio
    const portfolioCheck = await client.query('SELECT id FROM portfolios WHERE user_id = $1', [userId]);
    let portfolioId = portfolioCheck.rows[0]?.id;

    if (!portfolioId) {
      console.log(`No portfolio for user ${userId}, creating one.`);
      const portfolioRes = await client.query(
        'INSERT INTO portfolios (user_id, base_currency, default_investment_yield, tax_rate, projection_years) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [userId, 'USD', 7, 15, 10]
      );
      portfolioId = portfolioRes.rows[0].id;
    }

    // Add a default cash account if a portfolio was created
    if (portfolioId) {
      // Use ON CONFLICT to prevent duplicate accounts if seed is run multiple times
      await client.query(
        "INSERT INTO accounts (portfolio_id, name, type, balance, currency, taxable) VALUES ($1, 'Cash', 'cash', 10000, 'USD', false)",
        [portfolioId]
      );
    }

    await client.query('COMMIT');
    client.release();
    
    res.json({ success: true, userId, portfolioId });
  } catch (err) {
    console.error('Error seeding database:', err);
    res.status(500).json({ error: 'Failed to seed database' });
  }
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('--- An error occurred ---');
  console.error(err.stack);
  if (req.body) {
    console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));
  }
  res.status(500).json({ error: 'An internal server error occurred.', message: err.message });
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
