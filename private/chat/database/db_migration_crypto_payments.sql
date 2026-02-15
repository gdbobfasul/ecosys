-- Version: 1.0056
-- Migration: Add crypto payments and subscription tracking
-- Run this on existing databases to add new fields

-- Add crypto wallet fields
ALTER TABLE users ADD COLUMN crypto_wallet_btc TEXT;
ALTER TABLE users ADD COLUMN crypto_wallet_eth TEXT;
ALTER TABLE users ADD COLUMN crypto_wallet_bnb TEXT;
ALTER TABLE users ADD COLUMN crypto_wallet_kcy_meme TEXT;
ALTER TABLE users ADD COLUMN crypto_wallet_kcy_ams TEXT;

-- Add subscription tracking
ALTER TABLE users ADD COLUMN subscription_active INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN paid_until TEXT;
ALTER TABLE users ADD COLUMN last_payment_check TEXT;

-- Add emergency button tracking
ALTER TABLE users ADD COLUMN emergency_active INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN emergency_active_until TEXT;

-- Add manual activation (admin override)
ALTER TABLE users ADD COLUMN manually_activated INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN activation_reason TEXT;
ALTER TABLE users ADD COLUMN activated_by_admin_id INTEGER;

-- Add session tracking
ALTER TABLE users ADD COLUMN session_expires_at TEXT;

-- Create payment_overrides table
CREATE TABLE IF NOT EXISTS payment_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admin_users(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payment_overrides_user ON payment_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_overrides_admin ON payment_overrides(admin_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_active);
CREATE INDEX IF NOT EXISTS idx_users_paid_until ON users(paid_until);
