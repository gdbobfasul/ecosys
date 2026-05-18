-- ================================================================
-- MATCHMAKING SYSTEM DATABASE MIGRATION
-- Version: 1.0056
-- Date: February 14, 2026
-- Description: AI-powered matchmaking with criteria, invitations, blocks
-- ================================================================

-- ================================================================
-- TABLE 1: Matchmaking Criteria (50 fields per user)
-- User fills their ideal partner criteria
-- ================================================================
CREATE TABLE IF NOT EXISTS matchmaking_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  
  -- Physical Criteria (10 fields)
  height_min INTEGER,                    -- Минимален ръст (cm)
  height_max INTEGER,                    -- Максимален ръст (cm)
  weight_min INTEGER,                    -- Минимално тегло (kg)
  weight_max INTEGER,                    -- Максимално тегло (kg)
  age_min INTEGER,                       -- Минимална възраст
  age_max INTEGER,                       -- Максимална възраст
  hair_color TEXT,                       -- Цвят на косата (blonde, brunette, black, red, gray, other)
  eye_color TEXT,                        -- Цвят на очите (blue, green, brown, hazel, gray, other)
  body_type TEXT,                        -- Тип фигура (slim, athletic, average, curvy, plus-size)
  ethnicity TEXT,                        -- Етнос (caucasian, asian, african, hispanic, mixed, other)
  
  -- Lifestyle Criteria (10 fields)
  smoking TEXT,                          -- Тютюнопушене (never, occasionally, regularly, no-preference)
  drinking TEXT,                         -- Алкохол (never, socially, regularly, no-preference)
  diet TEXT,                             -- Диета (vegan, vegetarian, pescatarian, omnivore, no-preference)
  exercise TEXT,                         -- Спорт (never, occasionally, regularly, athlete, no-preference)
  pets TEXT,                             -- Домашни любимци (has-dogs, has-cats, has-both, no-pets, no-preference)
  children TEXT,                         -- Деца (has-children, wants-children, no-children, no-preference)
  living_situation TEXT,                 -- Жилище (own-house, own-apartment, renting, with-parents, no-preference)
  employment TEXT,                       -- Работа (employed, self-employed, student, unemployed, retired, no-preference)
  education TEXT,                        -- Образование (high-school, bachelor, master, phd, no-preference)
  religion TEXT,                         -- Религия (christian, muslim, jewish, buddhist, atheist, no-preference)
  
  -- Personality & Interests (15 fields)
  personality TEXT,                      -- Личност (introvert, extrovert, ambivert, no-preference)
  interests TEXT,                        -- Интереси (спорт, изкуство, музика, пътуване и т.н.) - comma separated
  music_taste TEXT,                      -- Музика (rock, pop, jazz, classical, electronic, no-preference)
  movies_taste TEXT,                     -- Филми (action, comedy, drama, horror, romance, no-preference)
  hobbies TEXT,                          -- Хобита - comma separated
  political_views TEXT,                  -- Политически възгледи (left, center, right, apolitical, no-preference)
  travel_frequency TEXT,                 -- Пътуване (never, occasionally, frequently, digital-nomad, no-preference)
  night_owl_or_early_bird TEXT,          -- Нощен човек или ранобудник
  introvert_or_extrovert TEXT,           -- Интроверт или екстроверт
  communication_style TEXT,              -- Стил на комуникация (direct, indirect, emotional, logical, no-preference)
  conflict_resolution TEXT,              -- Решаване на конфликти (avoid, discuss, compromise, dominant, no-preference)
  love_language TEXT,                    -- Език на любовта (words, acts, gifts, time, touch, no-preference)
  humor_type TEXT,                       -- Чувство за хумор (sarcastic, silly, dry, dark, playful, no-preference)
  relationship_goals TEXT,               -- Цели (casual, serious, marriage, friendship, no-preference)
  deal_breakers TEXT,                    -- Deal breakers - comma separated
  
  -- Location & Practical (10 fields)
  country TEXT,                          -- Държава
  city TEXT,                             -- Град
  distance_km INTEGER,                   -- Максимална дистанция (km)
  willing_to_relocate TEXT,              -- Готовност за местене (yes, no, maybe, no-preference)
  language_spoken TEXT,                  -- Говорими езици - comma separated
  income_range TEXT,                     -- Доход (low, medium, high, very-high, no-preference)
  financial_goals TEXT,                  -- Финансови цели (save, invest, spend, balance, no-preference)
  car_ownership TEXT,                    -- Кола (owns-car, no-car, no-preference)
  tech_savviness TEXT,                   -- Технологии (beginner, intermediate, advanced, expert, no-preference)
  social_media_usage TEXT,               -- Социални мрежи (heavy, moderate, light, none, no-preference)
  
  -- Relationship & Values (5 fields)
  family_values TEXT,                    -- Семейни ценности (traditional, modern, flexible, no-preference)
  jealousy_level TEXT,                   -- Ревност (low, medium, high, no-preference)
  independence_level TEXT,               -- Независимост (very-independent, balanced, needs-closeness, no-preference)
  future_plans TEXT,                     -- Планове за бъдещето (settle-down, travel, career, family, no-preference)
  commitment_level TEXT,                 -- Ниво на ангажираност (casual, exclusive, engaged, married, no-preference)
  
  -- Metadata
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)  -- One criteria set per user
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_criteria_user ON matchmaking_criteria(user_id);

-- ================================================================
-- TABLE 2: Matchmaking Dislikes (up to 500 records per user)
-- What user does NOT like - learned from blocking others
-- ================================================================
CREATE TABLE IF NOT EXISTS matchmaking_dislikes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  dislike_field TEXT NOT NULL,           -- Which field (e.g., "hair_color", "smoking")
  dislike_value TEXT NOT NULL,           -- Which value (e.g., "blonde", "regularly")
  blocked_user_id INTEGER,               -- User who was blocked (optional reference)
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_dislikes_user ON matchmaking_dislikes(user_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_dislikes_field ON matchmaking_dislikes(dislike_field);

-- ================================================================
-- TABLE 3: Matchmaking Invitations (sent invitations)
-- User A sends invitation to User B
-- ================================================================
CREATE TABLE IF NOT EXISTS matchmaking_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,            -- Who sent the invitation
  receiver_id INTEGER NOT NULL,          -- Who receives the invitation
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, blocked
  created_at TEXT DEFAULT (datetime('now')),
  responded_at TEXT,                     -- When receiver responded
  
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(sender_id, receiver_id)         -- Can't send duplicate invitations
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_inv_sender ON matchmaking_invitations(sender_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_inv_receiver ON matchmaking_invitations(receiver_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_inv_status ON matchmaking_invitations(status);

-- ================================================================
-- TABLE 4: Matchmaking Blocks (blocked users)
-- User blocks another user - they can't chat anymore
-- ================================================================
CREATE TABLE IF NOT EXISTS matchmaking_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blocker_id INTEGER NOT NULL,           -- Who blocked
  blocked_id INTEGER NOT NULL,           -- Who got blocked
  reason TEXT,                           -- Why blocked (optional)
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(blocker_id, blocked_id)         -- Can't block same person twice
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_blocks_blocker ON matchmaking_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_blocks_blocked ON matchmaking_blocks(blocked_id);

-- ================================================================
-- TABLE 5: Matchmaking Search History (payment tracking)
-- Each search costs $5 or €5
-- ================================================================
CREATE TABLE IF NOT EXISTS matchmaking_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  search_cost REAL NOT NULL DEFAULT 5.0, -- Cost in user's currency
  currency TEXT NOT NULL DEFAULT 'USD',  -- USD or EUR
  results_count INTEGER DEFAULT 0,       -- How many results returned
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matchmaking_searches_user ON matchmaking_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_searches_date ON matchmaking_searches(created_at);

-- ================================================================
-- VIEWS FOR EASY QUERYING
-- ================================================================

-- View: Active invitations for each user
CREATE VIEW IF NOT EXISTS v_active_invitations AS
SELECT 
  i.id,
  i.sender_id,
  s.full_name AS sender_name,
  s.age AS sender_age,
  s.city AS sender_city,
  i.receiver_id,
  r.full_name AS receiver_name,
  r.age AS receiver_age,
  r.city AS receiver_city,
  i.status,
  i.created_at
FROM matchmaking_invitations i
JOIN users s ON i.sender_id = s.id
JOIN users r ON i.receiver_id = r.id
WHERE i.status = 'pending';

-- View: User matchmaking profile with criteria count
CREATE VIEW IF NOT EXISTS v_matchmaking_profiles AS
SELECT 
  u.id AS user_id,
  u.full_name,
  u.age,
  u.gender,
  u.city,
  u.country,
  CASE WHEN mc.id IS NOT NULL THEN 1 ELSE 0 END AS has_criteria,
  (SELECT COUNT(*) FROM matchmaking_dislikes WHERE user_id = u.id) AS dislikes_count,
  (SELECT COUNT(*) FROM matchmaking_invitations WHERE sender_id = u.id) AS sent_invitations,
  (SELECT COUNT(*) FROM matchmaking_invitations WHERE receiver_id = u.id AND status = 'pending') AS pending_invitations,
  (SELECT COUNT(*) FROM matchmaking_blocks WHERE blocker_id = u.id) AS blocked_count,
  (SELECT COUNT(*) FROM matchmaking_searches WHERE user_id = u.id) AS total_searches
FROM users u
LEFT JOIN matchmaking_criteria mc ON u.id = mc.user_id;

-- ================================================================
-- TRIGGERS FOR AUTO-UPDATE
-- ================================================================

-- Update updated_at on criteria changes
CREATE TRIGGER IF NOT EXISTS update_matchmaking_criteria_timestamp 
AFTER UPDATE ON matchmaking_criteria
BEGIN
  UPDATE matchmaking_criteria SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ================================================================
-- SEED DATA (EXAMPLES)
-- ================================================================

-- Example criteria for testing
-- (Will be populated by users in production)

-- ================================================================
-- NOTES & DOCUMENTATION
-- ================================================================

-- FIELD DESCRIPTIONS:
-- 
-- Physical: Basic physical attributes and preferences
-- Lifestyle: Daily habits, living situation, children, pets
-- Personality: Interests, hobbies, communication style
-- Location: Geographic preferences and mobility
-- Relationship: Values, goals, commitment level
--
-- MATCHING ALGORITHM:
-- - User fills 50 criteria
-- - AI matches based on criteria + learned dislikes
-- - Each search costs $5/€5 from user balance
-- - Returns top 5 matches
--
-- INVITATION FLOW:
-- 1. User A searches and gets 5 results
-- 2. User A sends invitation to User B
-- 3. User B sees invitation in their inbox (50 max)
-- 4. User B can accept (→ chat) or block
-- 5. If blocked, User B selects what they didn't like
--
-- BLOCKING BEHAVIOR:
-- - Blocker can't see blocked user anymore
-- - Blocked user can't send messages to blocker
-- - Both ways blocked from chat
-- - System learns preferences from blocks
--
-- PAYMENT:
-- - Monthly subscription required (existing system)
-- - Each search deducts $5/€5 from balance
-- - User must have sufficient balance to search
-- - Admin can check matches for free

-- ================================================================
-- END OF MIGRATION
-- ================================================================
