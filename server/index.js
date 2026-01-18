import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';
import { OAuth2Client } from 'google-auth-library';

const { Pool } = pkg;
dotenv.config();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;
const freeEmailList = (process.env.STRIPE_FREE_USER_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const provisionTrialIfNeeded = async (user) => {
  if (!user || user.is_whitelisted) return user;
  const hasStatus = !!user.subscription_status;
  const hasTrial = !!user.trial_ends_at;
  if (hasStatus || hasTrial) return user;
  const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const updated = await pool.query(
    `UPDATE users
     SET subscription_status = 'trialing',
         trial_ends_at = $1
     WHERE id = $2
     RETURNING *`,
    [trialEnds, user.id]
  );
  return updated.rows[0] || user;
};
const ensureSubscriptionOk = (user) => {
  if (!user) return false;
  const isWhitelisted = !!user.is_whitelisted;
  if (isWhitelisted) return true;
  const trialOk = user.trial_ends_at ? new Date(user.trial_ends_at).getTime() > Date.now() : false;
  if (trialOk) return true;
  if (user.subscription_status === 'trialing') return true;
  if (user.subscription_status === 'active') {
    // Allow active even if period_end is missing
    const periodOk = user.subscription_period_end ? new Date(user.subscription_period_end).getTime() > Date.now() : true;
    return periodOk;
  }
  return false;
};

const refreshSubscriptionIfNeeded = async (user) => {
  if (!stripe || !user || !user.stripe_subscription_id) return user;
  const missingCore = !user.subscription_period_end || !user.subscription_status;
  const staleActive = ['active', 'trialing'].includes(user.subscription_status || '') && !user.subscription_period_end;
  const needsRefresh = missingCore || staleActive;
  if (!needsRefresh) return user;
  try {
    const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    const updated = await updateUserSubscriptionFromStripe(sub);
    return updated || user;
  } catch (err) {
    console.error('Failed to refresh subscription from Stripe', err.message);
  }
  return user;
};
const stripeSuccessUrl = process.env.CLIENT_URL
  ? `${process.env.CLIENT_URL}/?billing=success`
  : 'http://localhost:5173/?billing=success';
const stripeCancelUrl = process.env.CLIENT_URL
  ? `${process.env.CLIENT_URL}/?billing=cancel`
  : 'http://localhost:5173/?billing=cancel';

const priceIds = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID
};

const updateUserSubscriptionFromStripe = async (sub) => {
  if (!sub) return null;
  const status = sub.status;
  const hasScheduledCancel = !!sub.cancel_at || !!sub.cancel_at_period_end;
  const effectiveStatus = hasScheduledCancel ? 'canceled' : status;
  const customerId = sub.customer;
  const rawPeriodEnd = sub.current_period_end || sub.items?.data?.[0]?.current_period_end || sub.cancel_at || null;
  const periodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : null;
  const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : null;
  const effectiveEnd = periodEnd || trialEnd || null;
  console.log(`Updating subscription for customer ${customerId}: status=${effectiveStatus}, periodEnd=${effectiveEnd}, trialEnd=${trialEnd}`);

  let res = await pool.query(
    `UPDATE users
     SET stripe_customer_id = COALESCE($1, stripe_customer_id),
         stripe_subscription_id = $2,
         subscription_status = $3,
         subscription_period_end = $4,
         trial_ends_at = COALESCE($5, trial_ends_at)
     WHERE stripe_customer_id = $1 OR stripe_subscription_id = $2
     RETURNING *`,
    [customerId, sub.id, effectiveStatus, effectiveEnd, trialEnd]
  );

  if (res.rowCount === 0 && sub.metadata?.userId) {
    res = await pool.query(
      `UPDATE users
       SET stripe_customer_id = $1,
           stripe_subscription_id = $2,
           subscription_status = $3,
           subscription_period_end = $4,
           trial_ends_at = $5
       WHERE id = $6
       RETURNING *`,
      [customerId, sub.id, effectiveStatus, effectiveEnd, trialEnd, sub.metadata.userId]
    );
  }

  if (res.rowCount === 0) {
    return null;
  }

  return res.rows[0];
};

const app = express();
const port = process.env.PORT || 5001;
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const clientUrlOrigin = (() => {
  const raw = process.env.CLIENT_URL;
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();
const allowedOrigins = Array.from(
  new Set(
    (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : defaultOrigins)
      .map(o => o.trim())
      .filter(Boolean)
      .concat(clientUrlOrigin ? [clientUrlOrigin] : [])
  )
);
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
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const sendResetEmail = async (to, token) => {
  const resetBase = process.env.RESET_URL_BASE || process.env.CLIENT_URL || 'http://localhost:5173';
  const resetLink = `${resetBase}?token=${encodeURIComponent(token)}`;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';

  // Prefer Resend API if provided (avoids SMTP port issues)
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'Reset your password',
        text: `Reset your password: ${resetLink}`,
        html: `<p>Reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`
      })
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Resend API failed: ${res.status} ${msg}`);
    }
    return;
  }

  if (!transporter) {
    console.warn('SMTP not configured; printing reset link to console:', resetLink);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject: 'Reset your password',
    text: `Reset your password: ${resetLink}`,
    html: `<p>Reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p>`
  });
};

const sendVerificationEmail = async (to, token) => {
  const verifyBase = process.env.VERIFY_URL_BASE || process.env.CLIENT_URL || 'http://localhost:5173';
  const verifyLink = `${verifyBase}?verify=${encodeURIComponent(token)}`;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com';

  // Prefer Resend API if provided (avoids SMTP port issues)
  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject: 'Verify your email',
        text: `Verify your email: ${verifyLink}`,
        html: `<p>Verify your email:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`
      })
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`Resend API failed: ${res.status} ${msg}`);
    }
    return;
  }

  if (!transporter) {
    console.warn('SMTP not configured; printing verification link to console:', verifyLink);
    return;
  }

  await transporter.sendMail({
    from,
    to,
    subject: 'Verify your email',
    text: `Verify your email: ${verifyLink}`,
    html: `<p>Verify your email:</p><p><a href="${verifyLink}">${verifyLink}</a></p>`
  });
};

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true
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

// Stripe webhook (raw body) - must be before express.json
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Stripe not configured');
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const customerId = session.customer;
        const subscriptionId = session.subscription;
        if (userId && customerId) {
          await pool.query(
            'UPDATE users SET stripe_customer_id = $1, stripe_subscription_id = $2 WHERE id = $3',
            [customerId, subscriptionId || null, userId]
          );
        }
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await updateUserSubscriptionFromStripe(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await updateUserSubscriptionFromStripe(sub);
        break;
      }
      default:
        console.log('Unhandled event type', event.type);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Error handling webhook', err);
    res.status(500).send('Webhook handler failed');
  }
});

// Parse JSON bodies (for POST, etc.)
app.use(express.json());
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

const createEmailVerificationToken = async (userId) => {
  const token = makeResetToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
  await pool.query(
    `INSERT INTO email_verification_tokens (token_hash, user_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
    [tokenHash, userId, expires]
  );
  return token;
};

const useEmailVerificationToken = async (token) => {
  const tokenHash = hashToken(token);
  const res = await pool.query(
    `DELETE FROM email_verification_tokens
     WHERE token_hash = $1 AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return res.rows[0]?.user_id || null;
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
    // Verify user still exists and is verified
    const userRes = await pool.query('SELECT id, email, verified FROM users WHERE id = $1', [payload.userId]);
    const user = userRes.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: user not found' });
    }
    if (!user.verified) {
      clearAuthCookies(res);
      return res.status(403).json({ error: 'Email not verified', needVerification: true });
    }
    req.userId = user.id;
    req.userEmail = user.email;
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
  returnRate: Number(row.return_rate || 0),
  taxTreatment: row.tax_treatment ?? 'roth',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeTransferRule = (row) => {
  const freq = row.frequency || (row.one_time_at ? 'one_time' : 'annual');
  const intervalYears =
    freq === 'every_x_years'
      ? (row.interval_years && Number(row.interval_years)) || 1
      : null;
  return {
    id: row.id,
    projectionId: row.projection_id,
    portfolioId: row.portfolio_id,
    fromExternal: row.from_external,
    fromAccountId: row.from_account_id,
    toAccountId: row.to_account_id,
    toExternal: row.to_external,
    externalTarget: row.external_target,
    frequency: freq,
    intervalYears,
    startDate: row.start_date || row.one_time_at,
    endDate: row.end_date,
    startMilestoneId: row.start_milestone_id,
    endMilestoneId: row.end_milestone_id,
    externalAmount: Number(row.external_amount || 0),
    externalCurrency: row.external_currency,
    amountType: row.amount_type
  };
};

const normalizeMilestone = (row) => ({
  id: row.id,
  projectionId: row.projection_id,
  label: row.label,
  year: Number(row.year),
  sortOrder: row.sort_order ?? 0
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
  const isWhitelisted = freeEmailList.includes(email.toLowerCase());
  const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const initialStatus = isWhitelisted ? 'active' : 'trialing';
  const userRes = await pool.query(
    'INSERT INTO users (email, password_hash, verified, is_whitelisted, subscription_status, trial_ends_at) VALUES ($1, $2, FALSE, $3, $4, $5) RETURNING id, email, is_whitelisted, trial_ends_at, subscription_status, birthdate',
    [email, passwordHash, isWhitelisted, initialStatus, isWhitelisted ? null : trialEnds]
  );
  const user = userRes.rows[0];
  const verifyToken = await createEmailVerificationToken(user.id);
  try {
    await sendVerificationEmail(user.email, verifyToken);
  } catch (err) {
    console.error('Failed to send verification email', err);
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }
  }
  res.json({
    success: true,
    verificationSent: true,
    message: 'Check your email to verify your account before signing in.',
    devToken: process.env.NODE_ENV === 'production' ? undefined : verifyToken
  });
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
    'SELECT id, email, password_hash, verified, stripe_subscription_id FROM users WHERE email = $1',
    [email]
  );
  let user = userRes.rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash || '');
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.verified) {
    return res.status(403).json({ error: 'Email not verified. Please check your inbox for a verification link or request a new one.', needVerification: true });
  }

  // Always refresh Stripe subscription on login if available
  if (stripe && user.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      const updated = await updateUserSubscriptionFromStripe(sub);
      if (updated) {
        user = { ...user, ...updated };
      }
    } catch (err) {
      console.error('Failed to refresh subscription on login', err.message);
    }
  }

  const { token: accessToken, jti } = signAccessToken(user);
  const refreshToken = makeRefreshToken();
  const csrfToken = makeCsrfToken();
  const familyId = makeJti();
  await saveRefreshToken(refreshToken, user.id, familyId);
  setCookies(res, { accessToken, refreshToken, csrfToken });
  res.json({ user: { id: user.id, email: user.email }, csrfToken });
}));

app.post('/api/auth/google', asyncHandler(async (req, res) => {
  const { idToken } = req.body || {};
  if (!idToken) {
    return res.status(400).json({ error: 'Google ID token is required' });
  }
  if (!googleClient) {
    return res.status(500).json({ error: 'Google Sign-In is not configured (missing GOOGLE_CLIENT_ID on the server)' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleClientId
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.error('Google token verification failed', err.message);
    return res.status(401).json({ error: 'Invalid Google token' });
  }

  const email = payload?.email?.toLowerCase();
  const googleSub = payload?.sub;
  const emailVerified = payload?.email_verified;
  if (!email || !googleSub) {
    return res.status(400).json({ error: 'Google token missing email information' });
  }
  if (!emailVerified) {
    return res.status(403).json({ error: 'Google email is not verified' });
  }

  const isWhitelisted = freeEmailList.includes(email);
  const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const initialStatus = isWhitelisted ? 'active' : 'trialing';

  // Find user by google_sub (preferred) or email
  let userRes = await pool.query(
    'SELECT * FROM users WHERE google_sub = $1 OR email = $2',
    [googleSub, email]
  );
  let user = userRes.rows[0];

  if (!user) {
    const created = await pool.query(
      `INSERT INTO users (
        email,
        password_hash,
        verified,
        verified_at,
        google_sub,
        is_whitelisted,
        subscription_status,
        trial_ends_at
      )
       VALUES ($1, $2, TRUE, NOW(), $3, $4, $5, $6)
       RETURNING *`,
      [email, null, googleSub, isWhitelisted, initialStatus, isWhitelisted ? null : trialEnds]
    );
    user = created.rows[0];
  } else {
    // Link google_sub + mark verified; keep existing subscription fields unless missing
    const needsLink = user.google_sub !== googleSub;
    const shouldVerify = !user.verified;
    const shouldWhitelist = isWhitelisted && !user.is_whitelisted;
    if (needsLink || shouldVerify || shouldWhitelist) {
      const updated = await pool.query(
        `UPDATE users
         SET google_sub = COALESCE(google_sub, $2),
             verified = TRUE,
             verified_at = COALESCE(verified_at, NOW()),
             is_whitelisted = CASE WHEN $3 THEN TRUE ELSE is_whitelisted END
         WHERE id = $1
         RETURNING *`,
        [user.id, googleSub, shouldWhitelist]
      );
      user = updated.rows[0] || user;
    }
  }

  // Ensure we have trial provisioned for non-whitelisted users if missing
  user = await provisionTrialIfNeeded(user);

  // Always refresh Stripe subscription on Google login if available
  if (stripe && user.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
      const updated = await updateUserSubscriptionFromStripe(sub);
      if (updated) user = updated;
    } catch (err) {
      console.error('Failed to refresh subscription on Google login', err.message);
    }
  }

  const { token: accessToken } = signAccessToken(user);
  const refreshToken = makeRefreshToken();
  const csrfToken = makeCsrfToken();
  const familyId = makeJti();
  await saveRefreshToken(refreshToken, user.id, familyId);
  setCookies(res, { accessToken, refreshToken, csrfToken });
  res.json({ user: { id: user.id, email: user.email }, csrfToken });
}));

app.post('/api/auth/verify', asyncHandler(async (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: 'Verification token is required' });
  }
  const userId = await useEmailVerificationToken(token);
  if (!userId) {
    return res.status(400).json({ error: 'Invalid or expired verification token' });
  }
  const verified = await pool.query(
    'UPDATE users SET verified = TRUE, verified_at = NOW() WHERE id = $1 RETURNING id, email',
    [userId]
  );
  if (verified.rowCount === 0) {
    return res.status(400).json({ error: 'User not found for verification' });
  }
  await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  const user = verified.rows[0];
  const { token: accessToken, jti } = signAccessToken(user);
  const refreshToken = makeRefreshToken();
  const csrfToken = makeCsrfToken();
  const familyId = makeJti();
  await saveRefreshToken(refreshToken, user.id, familyId);
  setCookies(res, { accessToken, refreshToken, csrfToken });
  res.json({ user: { id: user.id, email: user.email }, csrfToken });
}));

app.post('/api/auth/verify/resend', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }
  const userRes = await pool.query('SELECT id, email, verified FROM users WHERE email = $1', [email]);
  const user = userRes.rows[0];
  if (!user) {
    // Do not reveal user existence
    return res.json({ success: true });
  }
  if (user.verified) {
    return res.json({ success: true, alreadyVerified: true });
  }
  await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);
  const verifyToken = await createEmailVerificationToken(user.id);
  try {
    await sendVerificationEmail(user.email, verifyToken);
  } catch (err) {
    console.error('Failed to send verification email', err);
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }
  }
  res.json({
    success: true,
    verificationSent: true,
    message: 'Verification email sent.',
    devToken: process.env.NODE_ENV === 'production' ? undefined : verifyToken
  });
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

  const userRes = await pool.query('SELECT id, email, verified, is_whitelisted, subscription_status, subscription_period_end FROM users WHERE id = $1', [stored.user_id]);
  const user = userRes.rows[0];
  if (!user || !user.verified) {
    clearAuthCookies(res);
    return res.status(403).json({ error: 'Email not verified', needVerification: true });
  }

  const { token: accessToken, jti } = signAccessToken({ id: user.id, email: user.email || '' });
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

// Create Stripe Checkout Session
app.post('/api/stripe/checkout', authenticate, requireCsrf, asyncHandler(async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const { plan } = req.body || {};
  const priceId = priceIds[plan];
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const userRes = await pool.query(
    'SELECT id, email, stripe_customer_id, is_whitelisted FROM users WHERE id = $1',
    [req.userId]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_whitelisted) {
    return res.json({ free: true });
  }

  let customerId = user.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id }
    });
    customerId = customer.id;
    await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Trial already granted at signup; don't add another Stripe trial
    subscription_data: { metadata: { userId: user.id } },
    metadata: { userId: user.id },
    success_url: stripeSuccessUrl,
    cancel_url: stripeCancelUrl
  });

  res.json({ url: session.url });
}));

// Billing portal
app.post('/api/stripe/portal', authenticate, requireCsrf, asyncHandler(async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const userRes = await pool.query(
    'SELECT stripe_customer_id, is_whitelisted FROM users WHERE id = $1',
    [req.userId]
  );
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_whitelisted) {
    return res.json({ free: true });
  }
  if (!user.stripe_customer_id) {
    return res.status(400).json({ error: 'No Stripe customer on file' });
  }
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripe_customer_id,
    return_url: stripeSuccessUrl
  });
  res.json({ url: portalSession.url });
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

// Onboarding tour state (per-user)
app.get('/api/user/onboarding', authenticate, asyncHandler(async (req, res) => {
  const userRes = await pool.query(
    'SELECT onboarding_version, onboarding_step, onboarding_completed_at FROM users WHERE id = $1',
    [req.userId]
  );
  const row = userRes.rows[0];
  res.json({
    version: row?.onboarding_version ?? 1,
    step: row?.onboarding_step ?? 0,
    completedAt: row?.onboarding_completed_at ?? null
  });
}));

app.post('/api/user/onboarding', authenticate, requireCsrf, asyncHandler(async (req, res) => {
  const { version, step, completed } = req.body || {};
  const nextVersion = Number.isFinite(Number(version)) ? Number(version) : 1;
  const nextStep = Number.isFinite(Number(step)) ? Math.max(0, Math.floor(Number(step))) : 0;
  const markCompleted = completed === true;

  const updated = await pool.query(
    `UPDATE users
     SET onboarding_version = $2,
         onboarding_step = $3,
         onboarding_completed_at = CASE WHEN $4 THEN NOW() ELSE NULL END
     WHERE id = $1
     RETURNING onboarding_version, onboarding_step, onboarding_completed_at`,
    [req.userId, nextVersion, nextStep, markCompleted]
  );
  const row = updated.rows[0];
  res.json({
    version: row?.onboarding_version ?? nextVersion,
    step: row?.onboarding_step ?? nextStep,
    completedAt: row?.onboarding_completed_at ?? (markCompleted ? new Date().toISOString() : null)
  });
}));

// Routes
app.get('/api/portfolio', authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const userRes = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    let user = userRes.rows[0];
    user = await refreshSubscriptionIfNeeded(user);
    user = await provisionTrialIfNeeded(user);
    if (!ensureSubscriptionOk(user)) {
      return res.status(402).json({ error: 'Subscription required' });
    }
    let portfolioRes = await pool.query(
      'SELECT * FROM portfolios WHERE user_id = $1',
      [userId]
    );
    if (portfolioRes.rows.length === 0) {
      const inserted = await pool.query(
        `INSERT INTO portfolios (user_id, base_currency, tax_rate, projection_years, fi_mode, fi_multiplier, fi_annual_expenses, fi_monthly_expenses, fi_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId, 'USD', 25, 10, 'annual_expenses', 25, 0, 0, 0]
      );
      if (inserted.rows.length > 0) {
        portfolioRes = { rows: [inserted.rows[0]] };
      } else {
        // Someone else created it; fetch again
        portfolioRes = await pool.query(
          'SELECT * FROM portfolios WHERE user_id = $1',
          [userId]
        );
      }
    }
    const portfolio = portfolioRes.rows[0];
    const userMeta = {
      subscriptionStatus: user.subscription_status,
      subscriptionPeriodEnd: user.subscription_period_end,
      trialEndsAt: user.trial_ends_at,
      isWhitelisted: user.is_whitelisted,
      birthdate: user.birthdate
    };
    
    // Accounts shared across projections
    const accountsRes = await pool.query(
      'SELECT * FROM accounts WHERE portfolio_id = $1',
      [portfolio.id]
    );
    const accounts = accountsRes.rows.map(normalizeAccount);
    const accountIds = accounts.map(a => a.id);

    // Projections (ensure at least one)
    let projectionsRes = await pool.query(
      'SELECT * FROM projections WHERE portfolio_id = $1 ORDER BY created_at ASC',
      [portfolio.id]
    );
    if (projectionsRes.rows.length === 0) {
      const created = await pool.query(
        `INSERT INTO projections (portfolio_id, name)
         VALUES ($1, $2)
         RETURNING *`,
        [portfolio.id, 'Projection 1']
      );
      projectionsRes = { rows: [created.rows[0]] };
    }
    const projectionRows = projectionsRes.rows;
  const projectionIds = projectionRows.map(p => p.id);

  // Transfer rules grouped per projection
  const rulesRes = projectionIds.length > 0
    ? await pool.query(
        'SELECT * FROM transfer_rules WHERE projection_id = ANY($1)',
        [projectionIds]
      )
    : { rows: [] };
  const rulesByProjection = new Map();
  rulesRes.rows.forEach(rule => {
    const normalized = normalizeTransferRule(rule);
    const list = rulesByProjection.get(rule.projection_id) || [];
    list.push(normalized);
    rulesByProjection.set(rule.projection_id, list);
  });

  // Milestones per projection
  const milestonesRes = projectionIds.length > 0
    ? await pool.query(
        'SELECT * FROM projection_milestones WHERE projection_id = ANY($1) ORDER BY sort_order ASC, year ASC, id ASC',
        [projectionIds]
      )
    : { rows: [] };
  const milestonesByProjection = new Map();
  milestonesRes.rows.forEach(row => {
    const norm = normalizeMilestone(row);
    const list = milestonesByProjection.get(row.projection_id) || [];
    list.push(norm);
    milestonesByProjection.set(row.projection_id, list);
  });

  // Per-projection account overrides
  const overridesRes = projectionIds.length > 0
    ? await pool.query(
        'SELECT * FROM projection_accounts WHERE projection_id = ANY($1)',
        [projectionIds]
        )
      : { rows: [] };
    const overridesByProjection = {};
    overridesRes.rows.forEach(row => {
      if (!overridesByProjection[row.projection_id]) {
        overridesByProjection[row.projection_id] = {};
      }
      const rate = Number(row.return_rate || 0);
      overridesByProjection[row.projection_id][row.account_id] = {
        returnRate: rate
      };
    });

    // Actual values shared across projections
    const actualRes = accountIds.length > 0
      ? await pool.query(
          'SELECT * FROM actual_values WHERE account_id = ANY($1)',
          [accountIds]
        )
      : { rows: [] };
    const actualValues = {};
    actualRes.rows.forEach(row => {
      if (!actualValues[row.account_id]) {
        actualValues[row.account_id] = {};
      }
      if (row.observed_at) {
        const key = typeof row.observed_at === 'string'
          ? row.observed_at.slice(0, 10)
          : [
              row.observed_at.getFullYear(),
              String(row.observed_at.getMonth() + 1).padStart(2, '0'),
              String(row.observed_at.getDate()).padStart(2, '0')
            ].join('-');
        actualValues[row.account_id][key] = Number(row.value);
      }
    });
  
    res.json({
      id: portfolio.id,
      userId: portfolio.user_id,
      baseCurrency: portfolio.base_currency,
      taxRate: portfolio.tax_rate,
      projectionYears: portfolio.projection_years,
      fiMode: portfolio.fi_mode || 'annual_expenses',
      fiMultiplier: portfolio.fi_multiplier ?? 25,
      fiAnnualExpenses: portfolio.fi_annual_expenses ?? 0,
      fiMonthlyExpenses: portfolio.fi_monthly_expenses ?? 0,
      fiValue: portfolio.fi_value ?? 0,
      subscriptionStatus: userMeta.subscriptionStatus,
      subscriptionPeriodEnd: userMeta.subscriptionPeriodEnd,
      trialEndsAt: userMeta.trialEndsAt,
      isWhitelisted: userMeta.isWhitelisted,
      birthdate: userMeta.birthdate,
      meta: userMeta,
      accounts,
      actualValues,
      projections: projectionRows.map(p => ({
        id: p.id,
        portfolioId: p.portfolio_id,
        name: p.name,
        inflationRate: p.inflation_rate ?? 0,
      projectionYears: portfolio.projection_years,
      taxRate: portfolio.tax_rate,
      createdAt: p.created_at,
      transferRules: rulesByProjection.get(p.id) || [],
      accountOverrides: overridesByProjection[p.id] || {},
      milestones: milestonesByProjection.get(p.id) || []
    }))
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
  const {
    accounts = [],
    actualValues = {},
    projections = [],
    baseCurrency,
    taxRate,
    projectionYears,
    fiMode = 'annual_expenses',
    fiMultiplier = 25,
    fiAnnualExpenses = 0,
    fiMonthlyExpenses = 0,
    fiValue = 0,
    birthdate = null
  } = req.body;
    const userRes = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    let user = userRes.rows[0];
    user = await refreshSubscriptionIfNeeded(user);
    user = await provisionTrialIfNeeded(user);
    if (!ensureSubscriptionOk(user)) {
      return res.status(402).json({ error: 'Subscription required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure user exists and update birthdate if provided
      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );
      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }
      if (birthdate !== undefined) {
        await client.query('UPDATE users SET birthdate = $2 WHERE id = $1', [userId, birthdate || null]);
      }
      
      const primaryProjection = projections[0] || {};
      // Upsert portfolio (base settings stay on parent record)
      const portfolioRes = await client.query(
        `INSERT INTO portfolios (user_id, base_currency, tax_rate, projection_years, fi_mode, fi_multiplier, fi_annual_expenses, fi_monthly_expenses, fi_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id) DO UPDATE SET
           base_currency = EXCLUDED.base_currency,
           tax_rate = EXCLUDED.tax_rate,
           projection_years = EXCLUDED.projection_years,
           fi_mode = EXCLUDED.fi_mode,
           fi_multiplier = EXCLUDED.fi_multiplier,
           fi_annual_expenses = EXCLUDED.fi_annual_expenses,
           fi_monthly_expenses = EXCLUDED.fi_monthly_expenses,
           fi_value = EXCLUDED.fi_value,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          userId,
          baseCurrency,
          primaryProjection.taxRate ?? taxRate,
          primaryProjection.projectionYears ?? projectionYears,
          fiMode,
          fiMultiplier,
          fiAnnualExpenses,
          fiMonthlyExpenses,
          fiValue
        ]
      );
      const portfolioId = portfolioRes.rows[0].id;

      const projectionsPayload = projections.length > 0 ? projections : [{
        name: 'Projection 1',
        transferRules: [],
        accountOverrides: {},
        inflationRate: 0,
        createdAt: new Date().toISOString()
      }];

      // Clean dependent tables; will be repopulated
      await client.query('DELETE FROM transfer_rules WHERE projection_id IN (SELECT id FROM projections WHERE portfolio_id = $1)', [portfolioId]);
      await client.query('DELETE FROM projection_milestones WHERE projection_id IN (SELECT id FROM projections WHERE portfolio_id = $1)', [portfolioId]);
      await client.query('DELETE FROM projection_accounts WHERE projection_id IN (SELECT id FROM projections WHERE portfolio_id = $1)', [portfolioId]);
      await client.query('DELETE FROM actual_values WHERE account_id IN (SELECT id FROM accounts WHERE portfolio_id = $1)', [portfolioId]);

      const accountIdMap = new Map();
      const existingAccountsRes = await client.query(
        `SELECT id, name, type, balance, currency, return_rate, tax_treatment
         FROM accounts WHERE portfolio_id = $1`,
        [portfolioId]
      );
      const existingAccountsById = new Map(
        existingAccountsRes.rows.map((row) => [String(row.id), row])
      );
      const existingAccountIds = new Set(existingAccountsById.keys());
      const incomingAccountIds = new Set();

      // Insert or update accounts and build ID map
      for (const account of accounts) {
        const accountRate = account.returnRate ?? 0;
        const taxTreatment = account.taxTreatment ?? 'roth';
        const createdAt = account.createdAt ? new Date(account.createdAt) : null;
        const incomingId = account.id != null ? String(account.id) : null;
        if (incomingId && existingAccountIds.has(incomingId)) {
          const existing = existingAccountsById.get(incomingId);
          const hasChanges = existing && (
            existing.name !== account.name ||
            existing.type !== account.type ||
            Number(existing.balance) !== Number(account.balance) ||
            existing.currency !== account.currency ||
            Number(existing.return_rate || 0) !== Number(accountRate) ||
            (existing.tax_treatment ?? 'roth') !== taxTreatment
          );
          if (hasChanges) {
            await client.query(
              `UPDATE accounts
               SET name = $1,
                   type = $2,
                   balance = $3,
                   currency = $4,
                   return_rate = $5,
                   tax_treatment = $6,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $7 AND portfolio_id = $8`,
              [
                account.name,
                account.type,
                account.balance,
                account.currency,
                accountRate,
                taxTreatment,
                Number(incomingId),
                portfolioId
              ]
            );
          }
          accountIdMap.set(incomingId, Number(incomingId));
          incomingAccountIds.add(incomingId);
        } else {
          const accountRes = await client.query(
            `INSERT INTO accounts (portfolio_id, name, type, balance, currency, return_rate, tax_treatment, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
             RETURNING id`,
            [
              portfolioId, account.name, account.type, account.balance,
              account.currency, accountRate, taxTreatment, createdAt
            ]
          );
          const dbId = accountRes.rows[0].id;
          if (incomingId) {
            accountIdMap.set(incomingId, dbId);
            incomingAccountIds.add(incomingId);
          } else {
            accountIdMap.set(String(dbId), dbId);
          }
        }
      }

      const deleteIds = Array.from(existingAccountIds)
        .filter((id) => !incomingAccountIds.has(id))
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id));
      if (deleteIds.length > 0) {
        await client.query(
          'DELETE FROM accounts WHERE portfolio_id = $1 AND id = ANY($2::int[])',
          [portfolioId, deleteIds]
        );
      }

      // Upsert projections and map any temporary IDs
      const projectionIdMap = new Map();
      for (const proj of projectionsPayload) {
        const createdAt = proj.createdAt ? new Date(proj.createdAt) : new Date();
        if (proj.id) {
          const updated = await client.query(
            `UPDATE projections
             SET name = $1, inflation_rate = $4
             WHERE id = $2 AND portfolio_id = $3
             RETURNING id`,
            [
              proj.name || 'Projection',
              proj.id,
              portfolioId,
              proj.inflationRate ?? 0
            ]
          );
          if (updated.rowCount > 0) {
            projectionIdMap.set(String(proj.id), updated.rows[0].id);
            continue;
          }
        }
        const inserted = await client.query(
          `INSERT INTO projections (portfolio_id, name, inflation_rate, created_at)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [
            portfolioId,
            proj.name || 'Projection',
            proj.inflationRate ?? 0,
            createdAt
          ]
        );
        projectionIdMap.set(String(proj.id || inserted.rows[0].id), inserted.rows[0].id);
      }

      const dbProjectionIds = Array.from(projectionIdMap.values());
      if (dbProjectionIds.length > 0) {
        await client.query('DELETE FROM transfer_rules WHERE projection_id = ANY($1)', [dbProjectionIds]);
        await client.query('DELETE FROM projection_accounts WHERE projection_id = ANY($1)', [dbProjectionIds]);
        await client.query(
          'DELETE FROM projections WHERE portfolio_id = $1 AND id != ALL($2)',
          [portfolioId, dbProjectionIds]
        );
      }

      // Insert per-projection account overrides and transfer rules
      for (const proj of projectionsPayload) {
        const dbProjId = projectionIdMap.get(String(proj.id)) || projectionIdMap.get(proj.id) || null;
        if (!dbProjId) continue;

        const overrides = proj.accountOverrides || {};
        for (const [accountId, override] of Object.entries(overrides)) {
          const dbAccountId = accountIdMap.get(String(accountId));
          if (!dbAccountId) {
            throw new Error(`Unknown account id ${accountId} for projection overrides`);
          }
          const overrideRate = override.returnRate ?? 0;
          await client.query(
            `INSERT INTO projection_accounts (projection_id, account_id, return_rate)
             VALUES ($1, $2, $3)
             ON CONFLICT (projection_id, account_id)
             DO UPDATE SET return_rate = EXCLUDED.return_rate`,
            [dbProjId, dbAccountId, overrideRate]
          );
        }

        // Insert milestones
        for (const m of proj.milestones || []) {
          await client.query(
            `INSERT INTO projection_milestones (projection_id, label, year, sort_order)
             VALUES ($1, $2, $3, $4)`,
            [
              dbProjId,
              m.label || 'Milestone',
              Number(m.year) || 0,
              m.sortOrder != null ? Number(m.sortOrder) : 0
            ]
          );
        }

        for (const rule of proj.transferRules || []) {
          const fromAccountId = rule.fromExternal
            ? null
            : (rule.fromAccountId ? accountIdMap.get(String(rule.fromAccountId)) : null);
          const toAccountId = rule.toExternal ? null : accountIdMap.get(String(rule.toAccountId));

          if (!rule.toExternal && !toAccountId && !rule.fromExternal) {
            throw new Error(`Unknown destination account id ${rule.toAccountId}`);
          }

          await client.query(
            `INSERT INTO transfer_rules (
              portfolio_id,
              projection_id,
              frequency,
              interval_years,
              start_date,
              start_milestone_id,
              end_date,
              end_milestone_id,
              one_time_at,
              from_external,
              from_account_id,
              to_account_id,
              to_external,
              external_target,
              external_amount,
              external_currency,
              amount_type
            )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
             RETURNING id`,
            [
              portfolioId,
              dbProjId,
              rule.frequency || 'annual',
              rule.frequency === 'every_x_years'
                ? (rule.intervalYears && Number(rule.intervalYears)) || 1
                : null,
              rule.startDate || null,
              rule.startMilestoneId || null,
              rule.frequency === 'one_time' ? null : (rule.endDate || null),
              rule.endMilestoneId || null,
              rule.frequency === 'one_time' ? (rule.startDate || null) : null,
              rule.fromExternal || false,
              fromAccountId,
              toAccountId,
              rule.toExternal || false,
              rule.externalTarget || null,
              rule.externalAmount,
              rule.externalCurrency,
              rule.amountType
            ]
          );
        }
      }

      // Upsert actual values against the remapped account IDs (date-based)
      for (const [accountId, valuesByDate] of Object.entries(actualValues)) {
        const dbAccountId = accountIdMap.get(String(accountId));
        if (!dbAccountId) {
          throw new Error(`Unknown account id ${accountId} for actual values`);
        }

        for (const [key, value] of Object.entries(valuesByDate || {})) {
          let observedAt = null;
          const keyStr = String(key);
          const dateMatch = keyStr.match(/^(\d{4})-(\d{2})(-(\d{2}))?$/);
          if (dateMatch) {
            // Use the provided string directly to avoid timezone shifts; if day missing, default to 01
            observedAt = dateMatch[3] ? keyStr : `${dateMatch[1]}-${dateMatch[2]}-01`;
          } else {
            // fallback: try to parse as year and store Jan 1
            const legacyYear = Number(key);
            if (!Number.isFinite(legacyYear)) continue;
            observedAt = `${legacyYear}-01-01`;
          }
          if (!observedAt) continue;
          await client.query(
            `INSERT INTO actual_values (account_id, observed_at, value)
             VALUES ($1, $2, $3)
             ON CONFLICT (account_id, observed_at)
             DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [dbAccountId, observedAt, value]
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
        'INSERT INTO portfolios (user_id, base_currency, tax_rate, projection_years) VALUES ($1, $2, $3, $4) RETURNING id',
        [userId, 'USD', 15, 10]
      );
      portfolioId = portfolioRes.rows[0].id;
    }

    const projectionCheck = await client.query('SELECT id FROM projections WHERE portfolio_id = $1', [portfolioId]);
    if (projectionCheck.rows.length === 0) {
      await client.query(
        'INSERT INTO projections (portfolio_id, name, tax_rate, projection_years) VALUES ($1, $2, $3, $4)',
        [portfolioId, 'Projection 1', 15, 10]
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
