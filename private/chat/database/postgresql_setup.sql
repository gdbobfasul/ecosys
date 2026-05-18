-- Version: 1.0056
-- PostgreSQL Schema for AMS Chat
-- Equivalent to SQLite db_setup.sql
-- Version: 1.0056

-- Enable UUID extension for potential future use
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
  age INTEGER,
  height_cm INTEGER,
  weight_kg INTEGER,
  country VARCHAR(100),
  city VARCHAR(100),
  village VARCHAR(100),
  street VARCHAR(200),
  workplace VARCHAR(200),
  paid_until TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_currency VARCHAR(10) NOT NULL DEFAULT 'BGN',
  country_code VARCHAR(5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  failed_login_attempts INTEGER DEFAULT 0,
  is_blocked INTEGER DEFAULT 0,
  blocked_reason TEXT,
  is_reported INTEGER DEFAULT 0,
  reported_count INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  
  -- Location
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  
  -- Profile
  profile_photo_url TEXT,
  offerings TEXT,
  working_hours VARCHAR(100),
  
  -- Search preferences
  search_preference VARCHAR(20) DEFAULT 'distance' CHECK (search_preference IN ('distance', 'need')),
  max_search_distance_km INTEGER DEFAULT 50,
  
  -- Crypto wallets
  crypto_wallet_btc VARCHAR(100),
  crypto_wallet_eth VARCHAR(100),
  crypto_wallet_usdt VARCHAR(100),
  crypto_wallet_kcy_meme VARCHAR(100),
  crypto_wallet_kcy_ams VARCHAR(100),
  
  -- Subscription tracking
  subscription_active INTEGER DEFAULT 0,
  last_payment_check TIMESTAMP,
  
  -- Emergency button tracking
  emergency_active INTEGER DEFAULT 0,
  emergency_active_until TIMESTAMP,
  
  -- Message customization
  message_font_family VARCHAR(50) DEFAULT 'Arial',
  message_font_size INTEGER DEFAULT 14,
  message_text_color VARCHAR(7) DEFAULT '#000000',
  message_bg_color VARCHAR(7) DEFAULT '#FFFFFF',
  
  -- Static object (from approved signals)
  is_static_object INTEGER DEFAULT 0,
  static_object_locked INTEGER DEFAULT 0,
  
  -- Signals tracking
  last_signal_date DATE,
  signals_submitted INTEGER DEFAULT 0,
  signals_approved INTEGER DEFAULT 0,
  free_days_earned INTEGER DEFAULT 0
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_read INTEGER DEFAULT 0,
  is_flagged INTEGER DEFAULT 0
);

-- Emergency contacts table
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id SERIAL PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  description TEXT,
  country_code VARCHAR(5) DEFAULT 'BG',
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  days_purchased INTEGER DEFAULT 1,
  
  -- Crypto payment details
  crypto_currency VARCHAR(20),
  crypto_amount DECIMAL(20, 8),
  crypto_address VARCHAR(100),
  crypto_tx_hash VARCHAR(100),
  crypto_confirmation_count INTEGER DEFAULT 0,
  
  -- Stripe details
  stripe_payment_intent_id VARCHAR(100),
  stripe_charge_id VARCHAR(100)
);

-- Flagged conversations table
CREATE TABLE IF NOT EXISTS flagged_conversations (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  flagged_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  flagged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed INTEGER DEFAULT 0,
  reviewed_by_admin_id INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  action_taken TEXT
);

-- Admin users table (for web admin panel)
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

-- Critical words table
CREATE TABLE IF NOT EXISTS critical_words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(100) UNIQUE NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Signals table
CREATE TABLE IF NOT EXISTS signals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type VARCHAR(100) NOT NULL,
  title VARCHAR(100) NOT NULL CHECK (LENGTH(title) <= 100),
  working_hours VARCHAR(50) CHECK (LENGTH(working_hours) <= 50),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  photo_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by_admin_id INTEGER REFERENCES users(id),
  created_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_paid ON users(paid_until);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location_latitude, location_longitude);
CREATE INDEX IF NOT EXISTS idx_users_static_object ON users(is_static_object);

CREATE INDEX IF NOT EXISTS idx_conversations_users ON conversations(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);

CREATE INDEX IF NOT EXISTS idx_flagged_conv_id ON flagged_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_flagged_conv_reviewed ON flagged_conversations(reviewed);

CREATE INDEX IF NOT EXISTS idx_critical_words_word ON critical_words(word);

CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_user ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_created_user ON signals(created_user_id);

-- Insert default admin (password: admin123 - CHANGE THIS!)
-- Password hash generated with bcrypt cost 10
INSERT INTO admin_users (username, password_hash) 
VALUES ('admin', '$2b$10$rBV2kHaW7RvJhWxGg0KhJeqGJ0Y9mYvH7K8KZxBqWqP4qOa8Jz0Ny')
ON CONFLICT (username) DO NOTHING;

-- Insert some default critical words
INSERT INTO critical_words (word) VALUES 
('drugs'), ('weapon'), ('illegal'), ('bomb'), ('terror'),
('kill'), ('murder'), ('kidnap'), ('ransom'), ('threat')
ON CONFLICT (word) DO NOTHING;
