<!-- Version: 1.0056 -->
# 🔧 TEST FIXES NEEDED

## CRITICAL SCHEMA MISMATCHES:

### 1. Messages Table:
**Real schema uses:**
- `from_user_id` / `to_user_id` (NOT sender_id/receiver_id)
- `text` (NOT content)
- NO `conversation_id` (direct user-to-user)
- NO `is_flagged` column

### 2. NO Conversations Table!
- Messages are direct between users
- NO separate conversations table
- Flagged conversations in separate table

### 3. DateTime syntax:
- SQLite: `datetime('now')` with single quotes
- Tests using: `datetime("now")` with double quotes ❌

### 4. UNIQUE constraints:
- Test DB doesn't enforce properly
- Need to use INSERT OR IGNORE or check beforehand

## FILES TO FIX:
1. auth-security.test.js - datetime syntax
2. messaging.test.js - COMPLETE REWRITE (wrong schema)
3. search.test.js - parameter count issue

## NEXT SESSION TASKS:
1. Fix all 3 test files
2. Complete Phase 2 tests (payments, profile, file-upload, admin)
3. Create mobile-specific tests
4. Final archive
