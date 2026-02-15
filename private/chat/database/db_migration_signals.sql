-- Version: 1.0056
-- Migration: Add Signals System
-- Date: 2026-01-30
-- Description: Add user-submitted signals with photo, location, and admin approval
--              When admin clicks "Approve", creates static object user in users table

-- Create signals table
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,                     -- Who submitted the signal
  signal_type TEXT NOT NULL,                    -- 'Pharmacy', 'Restaurant', etc. (offerings)
  title TEXT NOT NULL CHECK(length(title) <= 100),
  working_hours TEXT CHECK(length(working_hours) <= 50),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  submitted_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  processed_by_admin_id INTEGER,
  created_user_id INTEGER,                      -- The static object user ID created when approved
  rejection_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by_admin_id) REFERENCES users(id),
  FOREIGN KEY (created_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Add fields to users table
ALTER TABLE users ADD COLUMN is_static_object INTEGER DEFAULT 0;  -- If 1, location/photo/name are locked for owner
ALTER TABLE users ADD COLUMN created_from_signal_id INTEGER;      -- Reference to signal
ALTER TABLE users ADD COLUMN profile_photo_url TEXT;              -- Photo (profile for normal, object photo for static)
ALTER TABLE users ADD COLUMN working_hours TEXT CHECK(length(working_hours) <= 50);  -- Working hours

-- Add fields for signal submission tracking (regular users only)
ALTER TABLE users ADD COLUMN last_signal_date TEXT;               -- Last date user submitted signal
ALTER TABLE users ADD COLUMN free_days_earned INTEGER DEFAULT 0;  -- Count of free days from approved signals

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_signals_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_signals_user ON signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signals_created_user ON signals(created_user_id);
CREATE INDEX IF NOT EXISTS idx_users_static_object ON users(is_static_object);
CREATE INDEX IF NOT EXISTS idx_users_offerings ON users(offerings);

-- Note: New service categories will be added in utils/serviceCategories.js
