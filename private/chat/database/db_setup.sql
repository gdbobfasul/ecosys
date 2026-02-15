-- Version: 1.0056
-- AMS Chat Database Schema v4.3
-- Shared between Web & Mobile App
-- Added: crypto wallets, subscription tracking, payment overrides, test mode support

-- Users table - phone is NOT unique! phone + password_hash combination is unique
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK(gender IN ('male', 'female')),
  age INTEGER,
  height_cm INTEGER,
  weight_kg INTEGER,
  country TEXT,
  city TEXT,
  village TEXT,
  street TEXT,
  workplace TEXT,
  paid_until TEXT NOT NULL DEFAULT (datetime('now')),
  payment_amount REAL NOT NULL DEFAULT 0,
  payment_currency TEXT NOT NULL DEFAULT 'BGN',
  country_code TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT,
  failed_login_attempts INTEGER DEFAULT 0,
  is_blocked INTEGER DEFAULT 0,
  blocked_reason TEXT,
  is_reported INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  -- New fields for enhanced functionality
  code_word TEXT,                          -- Secret code for exact user search
  current_need TEXT,                       -- Current need/requirement (unlimited changes)
  offerings TEXT,                          -- What user offers (max 3, comma-separated, unlimited changes)
  is_verified INTEGER DEFAULT 0,           -- 1 = verified profile, offerings field is READ-ONLY
  email TEXT,                              -- Email for emergency contacts
  hide_phone INTEGER DEFAULT 0,            -- Hide phone number (show +359123...)
  hide_names INTEGER DEFAULT 0,            -- Hide names (show "Иван...")
  last_profile_update TEXT,                -- Last time profile was edited
  profile_edits_this_month INTEGER DEFAULT 0,  -- Count of edits this month
  profile_edit_reset_date TEXT DEFAULT (datetime('now')),  -- When to reset edit counter
  help_button_uses INTEGER DEFAULT 0,      -- Number of help button uses this month
  help_button_reset_date TEXT DEFAULT (datetime('now')),  -- When to reset help counter
  -- Location fields (admin captured)
  location_country TEXT,
  location_city TEXT,
  location_village TEXT,
  location_street TEXT,
  location_number TEXT,
  location_latitude REAL,
  location_longitude REAL,
  location_ip TEXT,
  location_captured_at TEXT,
  
  -- Crypto wallet addresses
  crypto_wallet_btc TEXT,
  crypto_wallet_eth TEXT,
  crypto_wallet_bnb TEXT,
  crypto_wallet_kcy_meme TEXT,
  crypto_wallet_kcy_ams TEXT,
  
  -- Subscription tracking
  subscription_active INTEGER DEFAULT 0,
  last_payment_check TEXT,
  
  -- Emergency button tracking
  emergency_active INTEGER DEFAULT 0,
  emergency_active_until TEXT,
  
  -- Manual activation (admin override)
  manually_activated INTEGER DEFAULT 0,
  activation_reason TEXT,
  activated_by_admin_id INTEGER,
  
  -- Session tracking
  session_expires_at TEXT,
  
  -- Signals system fields
  is_static_object INTEGER DEFAULT 0,          -- 1 = created from approved signal (location locked)
  created_from_signal_id INTEGER,              -- Reference to signal that created this object
  profile_photo_url TEXT,                      -- Profile photo (or object photo for static objects)
  working_hours TEXT CHECK(length(working_hours) <= 50),  -- Working hours (50 chars max)
  last_signal_date TEXT,                       -- Last date user submitted a signal
  free_days_earned INTEGER DEFAULT 0,          -- Count of free days earned from approved signals
  
  UNIQUE(phone, password_hash)
);

-- Sessions table (now links to user id, not phone)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  device_type TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Friends table (now uses user_id instead of phone)
CREATE TABLE IF NOT EXISTS friends (
  user_id1 INTEGER NOT NULL,
  user_id2 INTEGER NOT NULL,
  custom_name_by_user1 TEXT,
  custom_name_by_user2 TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id1, user_id2),
  CHECK (user_id1 < user_id2),
  FOREIGN KEY (user_id1) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id2) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages table (uses user_id)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  text TEXT,
  file_id TEXT,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  read_at TEXT,
  flagged INTEGER DEFAULT 0,
  edited_by_admin INTEGER DEFAULT 0,
  original_text TEXT,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Temp files table
CREATE TABLE IF NOT EXISTS temp_files (
  id TEXT PRIMARY KEY,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  downloaded INTEGER DEFAULT 0,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Payment logs
CREATE TABLE IF NOT EXISTS payment_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  stripe_payment_id TEXT,
  status TEXT NOT NULL,
  country_code TEXT,
  ip_address TEXT,
  payment_type TEXT DEFAULT 'new',
  months INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Critical words for monitoring (admin)
CREATE TABLE IF NOT EXISTS critical_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,
  added_at TEXT DEFAULT (datetime('now')),
  added_by TEXT DEFAULT 'admin'
);

-- Flagged conversations (admin monitoring)
CREATE TABLE IF NOT EXISTS flagged_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id1 INTEGER NOT NULL,
  user_id2 INTEGER NOT NULL,
  matched_word TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  message_text TEXT NOT NULL,
  conversation_context TEXT,
  flagged_at TEXT DEFAULT (datetime('now')),
  reviewed INTEGER DEFAULT 0,
  FOREIGN KEY (user_id1) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id2) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- Reports table (when users report each other)
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_user_id INTEGER NOT NULL,
  reported_user_id INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  last_login TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_paid ON users(paid_until);
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(is_blocked);
CREATE INDEX IF NOT EXISTS idx_users_reported ON users(is_reported);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(full_name);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);
CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_to ON messages(from_user_id, to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_flagged ON messages(flagged) WHERE flagged = 1;
CREATE INDEX IF NOT EXISTS idx_temp_files_expires ON temp_files(expires_at);

-- Emergency contacts table (police, ambulance, hospitals by country)
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_code TEXT NOT NULL,              -- 'BG', 'RU', 'LT', etc
  service_type TEXT NOT NULL,              -- 'police', 'ambulance', 'hospital', 'fire'
  service_name TEXT,                       -- e.g., "4th Police Station", "Pirogov Hospital"
  phone_international TEXT NOT NULL,       -- +359-2-982-1111
  phone_local TEXT,                        -- 166, 112, etc
  email TEXT,                              -- Contact email
  address TEXT,                            -- Full address
  latitude REAL,                           -- GPS coordinates
  longitude REAL,
  city TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Help button requests (emergency assistance)
CREATE TABLE IF NOT EXISTS help_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  gender TEXT,
  age INTEGER,
  country TEXT,
  city TEXT,
  street TEXT,
  street_number TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  request_time TEXT DEFAULT (datetime('now')),
  resolved INTEGER DEFAULT 0,
  resolved_at TEXT,
  admin_notes TEXT,
  charge_amount REAL,                      -- €50 or $50
  charge_currency TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Payment overrides table (admin manual activation)
CREATE TABLE IF NOT EXISTS payment_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,                    -- 'login' or 'emergency'
  days INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (admin_id) REFERENCES admin_users(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_emergency_country ON emergency_contacts(country_code);
CREATE INDEX IF NOT EXISTS idx_emergency_service ON emergency_contacts(service_type);
CREATE INDEX IF NOT EXISTS idx_emergency_location ON emergency_contacts(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_help_requests_user ON help_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_help_requests_resolved ON help_requests(resolved);
CREATE INDEX IF NOT EXISTS idx_help_requests_time ON help_requests(request_time);
CREATE INDEX IF NOT EXISTS idx_users_offerings ON users(offerings);
CREATE INDEX IF NOT EXISTS idx_users_need ON users(current_need);
CREATE INDEX IF NOT EXISTS idx_friends_user1 ON friends(user_id1);
CREATE INDEX IF NOT EXISTS idx_friends_user2 ON friends(user_id2);
CREATE INDEX IF NOT EXISTS idx_flagged_conv_reviewed ON flagged_conversations(reviewed);
CREATE INDEX IF NOT EXISTS idx_critical_words_word ON critical_words(word);

-- Signals system index for users
CREATE INDEX IF NOT EXISTS idx_users_static_object ON users(is_static_object);

-- Signals table
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  signal_type TEXT NOT NULL,
  title TEXT NOT NULL CHECK(length(title) <= 100),
  working_hours TEXT CHECK(length(working_hours) <= 50),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  submitted_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  processed_by_admin_id INTEGER,
  created_user_id INTEGER,
  rejection_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by_admin_id) REFERENCES users(id),
  FOREIGN KEY (created_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Signals table indexes
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_user ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_created_user ON signals(created_user_id);

-- Insert default admin (password: admin123 - CHANGE THIS!)
INSERT OR IGNORE INTO admin_users (username, password_hash) 
VALUES ('admin', '$2b$10$rBV2kHaW7RvJhWxGg0KhJeqGJ0Y9mYvH7K8KZxBqWqP4qOa8Jz0Ny');

-- Insert some default critical words
INSERT OR IGNORE INTO critical_words (word) VALUES 
('drugs'), ('weapon'), ('illegal'), ('bomb'), ('terror'),
('kill'), ('murder'), ('kidnap'), ('ransom'), ('threat');
