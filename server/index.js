import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const { Pool } = pkg;
dotenv.config();

const app = express();
const port = process.env.PORT || 5001;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const ACCESS_TOKEN_TTL = process.env.JWT_TTL || '10m'; // short-lived
const REFRESH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days sliding
const REVOKED_JTI_TTL_MS = 1000 * 60 * 60 * 24; // keep blacklisted jti for 24h
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set. Set a strong secret in server/.env for production.');
}

// Email (reset) setup
const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

const sendResetEmail = async (to, token) => {
  const resetBase = process.env.RESET_URL_BASE || process.env.CLIENT_URL || 'http://localhost:5173';
  const resetLink = `${resetBase}?token=${encodeURIComponent(token)}`;

  if (!transporter) {
    console.warn('SMTP not configured; printing reset link to console:', resetLink);
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';
  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your password',
    text: `Reset your password: ${resetLink}`,
    html: `<p>Reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`
  });
};

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Parse JSON bodies (for POST, etc.)
app.use(express.json({
  // Add an error handler directly to the JSON parser middleware
  verify: (req, res, buf, encoding) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      console.error('Invalid JSON received:', buf.toString(encoding));
      res.status(400).send('Invalid JSON');
      throw new Error('Invalid JSON');
    }
  }
}));
// Enable cookie parsing for optional httpOnly auth cookie usage
app.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return next();
  req.cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  next();
});


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  user: process.env.DB_USER || 'portfolio_user',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'portfolio_manager',
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

const makeCsrfToken = () => crypto.randomBytes(16).toString('hex');
const makeRefreshToken = () => crypto.randomBytes(32).toString('hex');
const makeJti = () => crypto.randomBytes(12).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const makeResetToken = () => crypto.randomBytes(32).toString('hex');

const setCookies = (res, { accessToken, refreshToken, csrfToken }) => {
  const secure = process.env.NODE_ENV === 'production';
  if (accessToken) {
    res.cookie('pm_access', accessToken, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60, // 1 hour max for cookie; token TTL controls validity
    });
  }
  if (refreshToken) {
    res.cookie('pm_refresh', refreshToken, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      maxAge: REFRESH_TOKEN_TTL_MS,
      path: '/api/auth',
    });
  }
  if (csrfToken) {
    res.cookie('pm_csrf', csrfToken, {
      httpOnly: false,
      secure,
      sameSite: secure ? 'none' : 'lax',
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
  }
};

const clearAuthCookies = (res) => {
  const secure = process.env.NODE_ENV === 'production';
  ['pm_access', 'pm_refresh', 'pm_csrf'].forEach(name => {
    res.cookie(name, '', { httpOnly: name !== 'pm_csrf', secure, sameSite: secure ? 'none' : 'lax', expires: new Date(0) });
  });
};

const signAccessToken = (user) => {
  const jti = makeJti();
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET || 'dev-secret',
    { expiresIn: ACCESS_TOKEN_TTL, jwtid: jti }
  );
  return { token, jti };
};

const saveRefreshToken = async (token, userId, familyId) => {
  const tokenHash = hashToken(token);
  await pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at, family_id)
     VALUES ($1, $2, $3, $4)`,
    [tokenHash, userId, new Date(Date.now() + REFRESH_TOKEN_TTL_MS), familyId]
  );
  return tokenHash;
};

const rotateRefreshToken = async (oldHash, newToken, familyId, userId) => {
  const newHash = hashToken(newToken);
  await pool.query('UPDATE refresh_tokens SET revoked = TRUE, replaced_by = $2 WHERE token_hash = $1', [oldHash, newHash]);
  await pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, expires_at, family_id)
     VALUES ($1, $2, $3, $4)`,
    [newHash, userId, new Date(Date.now() + REFRESH_TOKEN_TTL_MS), familyId]
  );
  return newHash;
};

const findRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  const res = await pool.query(
    `SELECT rt.token_hash, rt.user_id, rt.expires_at, rt.revoked, rt.family_id, u.email
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );
  return res.rows[0] ? { ...res.rows[0], tokenHash } : null;
};

const deleteRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
};

const revokeRefreshToken = async (token) => {
  const tokenHash = hashToken(token);
  await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1', [tokenHash]);
};

const createPasswordResetToken = async (userId) => {
  const token = makeResetToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
  await pool.query(
    `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [tokenHash, userId, expires]
  );
  return token;
};

const usePasswordResetToken = async (token) => {
  const tokenHash = hashToken(token);
  const res = await pool.query(
    `DELETE FROM password_reset_tokens
     WHERE token_hash = $1 AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return res.rows[0]?.user_id || null;
};

const blacklistJti = async (jti) => {
  if (!jti) return;
  await pool.query(
    `INSERT INTO revoked_jti (jti, expires_at) VALUES ($1, $2)
     ON CONFLICT (jti) DO NOTHING`,
    [jti, new Date(Date.now() + REVOKED_JTI_TTL_MS)]
  );
};

const isJtiRevoked = async (jti) => {
  if (!jti) return false;
  const res = await pool.query('SELECT 1 FROM revoked_jti WHERE jti = $1 AND expires_at > NOW()', [jti]);
  return res.rowCount > 0;
};

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookieToken = req.cookies?.pm_access;
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (await isJtiRevoked(payload.jti)) {
      return res.status(401).json({ error: 'Unauthorized: token revoked' });
    }
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.jti = payload.jti;
    next();
  } catch (err) {
    console.error('Invalid token', err);
    return res.status(401).json({ error: 'Unauthorized: invalid token' });
  }
};

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

const requireCsrf = (req, res, next) => {
  const cookieToken = req.cookies?.pm_csrf;
  const headerToken = req.headers['x-csrf-token'];
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token missing or invalid' });
  }
  next();
};

const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 20;
const isRateLimited = (key) => {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
  if (entry.reset < now) {
    rateLimitStore.delete(key);
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  rateLimitStore.set(key, entry);
  return false;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isStrongPassword = (pwd = '') => pwd.length >= 8 && /[A-Za-z]/.test(pwd) && /\d/.test(pwd);

// Auth routes
app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const key = `reg:${req.ip}`;
  if (isRateLimited(key)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userRes = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
    [email, passwordHash]
  );
  const user = userRes.rows[0];
  const { token: accessToken, jti } = signAccessToken(user);
  const refreshToken = makeRefreshToken();
  const csrfToken = makeCsrfToken();
  const familyId = makeJti();
  await saveRefreshToken(refreshToken, user.id, familyId);
  setCookies(res, { accessToken, refreshToken, csrfToken });
  res.json({ user, csrfToken });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  const key = `login:${req.ip}`;
  if (isRateLimited(key)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const userRes = await pool.query(
    'SELECT id, email, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = userRes.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash || '');
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const { token: accessToken, jti } = signAccessToken(user);
  const refreshToken = makeRefreshToken();
  const csrfToken = makeCsrfToken();
  const familyId = makeJti();
  await saveRefreshToken(refreshToken, user.id, familyId);
  setCookies(res, { accessToken, refreshToken, csrfToken });
  res.json({ user: { id: user.id, email: user.email }, csrfToken });
}));

app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.pm_refresh;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Missing refresh token' });
  }
  const stored = await findRefreshToken(refreshToken);
  if (!stored || stored.revoked) {
    // Possible reuse; clear cookies and force logout
    if (stored && stored.family_id) {
      await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1', [stored.family_id]);
    }
    await blacklistJti(req.jti);
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
  if (new Date(stored.expires_at).getTime() < Date.now()) {
    await deleteRefreshToken(refreshToken);
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  const { token: accessToken, jti } = signAccessToken({ id: stored.user_id, email: stored.email || '' });
  const newRefresh = makeRefreshToken();
  const csrfToken = makeCsrfToken();

  await rotateRefreshToken(stored.tokenHash, newRefresh, stored.family_id, stored.user_id);
  setCookies(res, { accessToken, refreshToken: newRefresh, csrfToken });
  res.json({ user: { id: stored.user_id, email: stored.email || '' }, csrfToken });
}));

app.post('/api/auth/logout', authenticate, requireCsrf, asyncHandler(async (req, res) => {
  const refreshToken = req.cookies?.pm_refresh;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  if (req.jti) {
    await blacklistJti(req.jti);
  }
  clearAuthCookies(res);
  res.json({ success: true });
}));

// Request password reset
app.post('/api/auth/reset/request', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const userRes = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
  const user = userRes.rows[0];
  if (!user) {
    // Do not reveal whether user exists
    return res.json({ success: true });
  }
  const token = await createPasswordResetToken(user.id);
  try {
    await sendResetEmail(user.email, token);
  } catch (err) {
    console.error('Failed to send reset email', err);
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Failed to send reset email' });
    }
  }
  res.json({ success: true, resetToken: process.env.NODE_ENV === 'production' ? undefined : token });
}));

// Confirm password reset
app.post('/api/auth/reset/confirm', asyncHandler(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (!isStrongPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers' });
  }

  const userId = await usePasswordResetToken(token);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid or expired reset token' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
  res.json({ success: true });
}));

// Delete current user and cascade data
app.delete('/api/user', authenticate, requireCsrf, asyncHandler(async (req, res) => {
  const userId = req.userId;
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  clearAuthCookies(res);
  res.json({ success: true });
}));

// Routes
app.get('/api/portfolio', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    
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

app.post('/api/portfolio', authenticate, requireCsrf, asyncHandler(async (req, res, next) => {
  const userId = req.userId;
  const { accounts = [], transferRules = [], actualValues = {}, ...portfolioSettings } = req.body;
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure user exists
      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );
      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }
      
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
      const portfolioId = portfolioRes.rows[0].id;

      // Clear old data
      await client.query('DELETE FROM transfer_rules WHERE portfolio_id = $1', [portfolioId]);
      // Also delete actual_values linked to the accounts being deleted
      await client.query('DELETE FROM actual_values WHERE account_id IN (SELECT id FROM accounts WHERE portfolio_id = $1)', [portfolioId]);
      await client.query('DELETE FROM accounts WHERE portfolio_id = $1', [portfolioId]);

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
  if (process.env.ALLOW_SEED !== 'true') {
    return res.status(403).json({ error: 'Seeding disabled' });
  }
  try {

    const client = await pool.connect();
    await client.query('BEGIN');

    // Create user if doesn't exist
    const seedPasswordHash = await bcrypt.hash(process.env.SEED_PASSWORD || 'password123', 10);
    await client.query(
      "INSERT INTO users (id, email, password_hash) VALUES (1, 'test@example.com', $1) ON CONFLICT (id) DO NOTHING",
      [seedPasswordHash]
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
  // Avoid logging sensitive fields like passwords
  if (req.body) {
    const safeBody = { ...req.body };
    if (safeBody.password) safeBody.password = '[redacted]';
    console.error('Request body that caused error:', JSON.stringify(safeBody, null, 2));
  }
  res.status(500).json({ error: 'An internal server error occurred.', message: err.message });
});

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
