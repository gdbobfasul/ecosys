-- Version: 1.0056
-- Example Future Migration
-- This shows how to add NEW fields in the future
-- Date: 2026-XX-XX
-- Description: Add profile photo support

-- Add new column to users table
ALTER TABLE users ADD COLUMN profile_photo_url TEXT;
ALTER TABLE users ADD COLUMN photo_uploaded_at TEXT;
ALTER TABLE users ADD COLUMN photo_verified INTEGER DEFAULT 0;

-- Create new table for photo reports
CREATE TABLE IF NOT EXISTS photo_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  reported_by INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reported_by) REFERENCES users(id)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_photo_reports_user ON photo_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_users_photo_verified ON users(photo_verified);
