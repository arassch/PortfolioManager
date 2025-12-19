-- Tokens
DELETE FROM refresh_tokens WHERE expires_at < NOW();
DELETE FROM revoked_jti WHERE expires_at < NOW();
DELETE FROM email_verification_tokens WHERE expires_at < NOW();
DELETE FROM password_reset_tokens WHERE expires_at < NOW();

-- Expired trials (adjust window as needed)
DELETE FROM users
WHERE is_whitelisted = FALSE
  AND subscription_status IN ('trialing','past_due','incomplete')
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at < NOW() - INTERVAL '30 days';

-- Optional: unverified accounts older than 30 days
-- DELETE FROM users
-- WHERE verified = FALSE
--   AND created_at < NOW() - INTERVAL '30 days';
-- Note: Be cautious with this query to avoid deleting active users.