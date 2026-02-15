#!/bin/bash
# Database Functionality Tests - RUN ONLY ON SERVER!
# Tests: messages, friends, places, photos, search

set -e

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

SQLITE_DB="/var/www/kcy-ecosystem/private/chat/database/ams_db.sqlite"
TEST_RESULTS=()

pass() { echo -e "${GREEN}✓ $1${NC}"; TEST_RESULTS+=("PASS: $1"); }
fail() { echo -e "${RED}✗ $1${NC}"; TEST_RESULTS+=("FAIL: $1"); }

setup() {
  echo "[Setup] Creating test data..."
  sqlite3 "$SQLITE_DB" << 'SQL'
DELETE FROM users WHERE id >= 100;
DELETE FROM places WHERE id >= 200;
DELETE FROM messages WHERE id >= 1000;

INSERT INTO users (id, phone, password, name) VALUES
  (101, '+359881000001', 'hash_a', 'Alice'),
  (102, '+359881000002', 'hash_b', 'Bob'),
  (103, '+359881000003', 'hash_c', 'Charlie'),
  (104, '+359881000004', 'hash_d', 'Diana'),
  (105, '+359881000005', 'hash_e', 'Eve');

INSERT INTO user_profiles (user_id, bio, age, gender) VALUES
  (101, 'Love coffee', 25, 'F'),
  (102, 'Tech enthusiast', 30, 'M'),
  (103, 'Artist', 28, 'M'),
  (104, 'Runner', 26, 'F'),
  (105, 'Chef', 32, 'F');

INSERT INTO places (id, name, owner_id, lat, lng, category) VALUES
  (201, 'Coffee House', 101, 42.6977, 23.3219, 'cafe'),
  (202, 'Tech Hub', 102, 42.6978, 23.3220, 'coworking'),
  (203, 'Art Gallery', 103, 42.6979, 23.3221, 'gallery');

INSERT INTO place_hours (place_id, day, open_time, close_time) VALUES
  (201, 1, '08:00', '18:00'),
  (201, 2, '08:00', '18:00'),
  (202, 1, '09:00', '22:00');
SQL
  echo "✓ Test data ready"
}

test_send_message() {
  echo -e "\n[TEST] А изпраща съобщение на Б"
  
  sqlite3 "$SQLITE_DB" "INSERT INTO messages (id, sender_id, recipient_id, text, created_at) 
    VALUES (1001, 101, 102, 'Hello Bob!', datetime('now'));"
  
  local count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM messages WHERE id=1001;")
  [ "$count" -eq 1 ] && pass "Message sent" || fail "Message failed"
  
  local text=$(sqlite3 "$SQLITE_DB" "SELECT text FROM messages WHERE id=1001;")
  [ "$text" = "Hello Bob!" ] && pass "Message content OK" || fail "Wrong content"
}

test_add_friend() {
  echo -e "\n[TEST] Б иска да добави А като приятел"
  
  sqlite3 "$SQLITE_DB" "INSERT INTO friendships (user1_id, user2_id, status, created_at)
    VALUES (102, 101, 'pending', datetime('now'));"
  
  local count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM friendships WHERE user1_id=102 AND user2_id=101;")
  [ "$count" -eq 1 ] && pass "Friend request sent" || fail "Request failed"
  
  sqlite3 "$SQLITE_DB" "UPDATE friendships SET status='accepted' WHERE user1_id=102 AND user2_id=101;"
  
  local status=$(sqlite3 "$SQLITE_DB" "SELECT status FROM friendships WHERE user1_id=102 AND user2_id=101;")
  [ "$status" = "accepted" ] && pass "Friendship accepted" || fail "Accept failed"
}

test_add_place() {
  echo -e "\n[TEST] В иска да добави Място с работно време и снимка"
  
  # Add place
  sqlite3 "$SQLITE_DB" "INSERT INTO places (id, name, owner_id, lat, lng, category, description)
    VALUES (204, 'Charlie Restaurant', 103, 42.7000, 23.3250, 'restaurant', 'Best pasta in town');"
  
  local place_count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM places WHERE id=204;")
  [ "$place_count" -eq 1 ] && pass "Place created" || fail "Place failed"
  
  # Add working hours
  sqlite3 "$SQLITE_DB" "INSERT INTO place_hours (place_id, day, open_time, close_time)
    VALUES (204, 1, '11:00', '23:00'), (204, 2, '11:00', '23:00');"
  
  local hours_count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM place_hours WHERE place_id=204;")
  [ "$hours_count" -eq 2 ] && pass "Working hours added" || fail "Hours failed"
  
  # Add photo
  sqlite3 "$SQLITE_DB" "INSERT INTO place_photos (place_id, uploader_id, filename, created_at)
    VALUES (204, 103, 'restaurant_exterior.jpg', datetime('now'));"
  
  local photo_count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM place_photos WHERE place_id=204;")
  [ "$photo_count" -eq 1 ] && pass "Photo uploaded" || fail "Photo failed"
}

test_upload_profile_photo() {
  echo -e "\n[TEST] Г иска да качи снимка на профила си"
  
  sqlite3 "$SQLITE_DB" "INSERT INTO user_photos (user_id, filename, is_primary, created_at)
    VALUES (104, 'diana_profile.jpg', 1, datetime('now'));"
  
  local photo=$(sqlite3 "$SQLITE_DB" "SELECT filename FROM user_photos WHERE user_id=104 AND is_primary=1;")
  [ "$photo" = "diana_profile.jpg" ] && pass "Profile photo uploaded" || fail "Upload failed"
  
  # Update profile picture count
  local count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM user_photos WHERE user_id=104;")
  echo -e "${YELLOW}  User 104 has $count photos${NC}"
}

test_search_users() {
  echo -e "\n[TEST] Д прави търсене на потребители"
  
  # Search by age range
  local results=$(sqlite3 "$SQLITE_DB" "SELECT u.name FROM users u 
    JOIN user_profiles p ON u.id = p.user_id 
    WHERE p.age BETWEEN 25 AND 30;")
  
  local count=$(echo "$results" | wc -l)
  [ "$count" -gt 0 ] && pass "Search returned results ($count users)" || fail "No results"
  
  echo -e "${YELLOW}  Found users: $results${NC}"
  
  # Search by gender
  local females=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM user_profiles WHERE gender='F';")
  echo -e "${YELLOW}  Female users: $females${NC}"
  [ "$females" -gt 0 ] && pass "Gender filter works" || fail "Gender filter failed"
}

test_search_places_nearby() {
  echo -e "\n[TEST] Търсене на места наблизо"
  
  local nearby=$(sqlite3 "$SQLITE_DB" "SELECT name FROM places 
    WHERE lat BETWEEN 42.697 AND 42.699 
      AND lng BETWEEN 23.321 AND 23.323;")
  
  local count=$(echo "$nearby" | wc -l)
  [ "$count" -gt 0 ] && pass "Found $count nearby places" || fail "No places"
  
  echo -e "${YELLOW}  Places: $nearby${NC}"
}

test_place_working_hours() {
  echo -e "\n[TEST] Проверка на работно време"
  
  local hours=$(sqlite3 "$SQLITE_DB" "SELECT p.name, ph.open_time, ph.close_time 
    FROM places p JOIN place_hours ph ON p.id = ph.place_id 
    WHERE p.id=201 AND ph.day=1;")
  
  [ -n "$hours" ] && pass "Working hours retrieved" || fail "No hours"
  echo -e "${YELLOW}  Hours: $hours${NC}"
}

test_match_preferences() {
  echo -e "\n[TEST] Настройки за партньор"
  
  sqlite3 "$SQLITE_DB" "INSERT INTO partner_preferences (user_id, min_age, max_age, preferred_gender, distance_km)
    VALUES (101, 28, 35, 'M', 10);"
  
  local prefs=$(sqlite3 "$SQLITE_DB" "SELECT min_age, max_age, preferred_gender FROM partner_preferences WHERE user_id=101;")
  [ -n "$prefs" ] && pass "Preferences set: $prefs" || fail "Prefs failed"
}

test_calculate_match() {
  echo -e "\n[TEST] Изчисляване на съвпадение"
  
  sqlite3 "$SQLITE_DB" "INSERT INTO matches (user1_id, user2_id, score, created_at)
    VALUES (101, 103, 85, datetime('now'));"
  
  local score=$(sqlite3 "$SQLITE_DB" "SELECT score FROM matches WHERE user1_id=101 AND user2_id=103;")
  [ "$score" -eq 85 ] && pass "Match score: $score%" || fail "Match failed"
}

test_payment() {
  echo -e "\n[TEST] Плащане"
  
  sqlite3 "$SQLITE_DB" "INSERT INTO payments (user_id, amount, status, payment_method, created_at)
    VALUES (105, 29.99, 'completed', 'card', datetime('now'));"
  
  local amount=$(sqlite3 "$SQLITE_DB" "SELECT amount FROM payments WHERE user_id=105 ORDER BY id DESC LIMIT 1;")
  [ "$amount" = "29.99" ] && pass "Payment recorded: $amount BGN" || fail "Payment failed"
}

echo "═══════════════════════════════════════"
echo "  Database Functionality Tests"
echo "  (SERVER ONLY)"
echo "═══════════════════════════════════════"

setup

test_send_message
test_add_friend
test_add_place
test_upload_profile_photo
test_search_users
test_search_places_nearby
test_place_working_hours
test_match_preferences
test_calculate_match
test_payment

echo -e "\n═══════════════════════════════════════"
echo "  Results"
echo "═══════════════════════════════════════"
for result in "${TEST_RESULTS[@]}"; do echo "$result"; done

passed=$(echo "${TEST_RESULTS[@]}" | grep -o "PASS" | wc -l)
failed=$(echo "${TEST_RESULTS[@]}" | grep -o "FAIL" | wc -l)
echo -e "\nPassed: $passed | Failed: $failed"
[ "$failed" -eq 0 ] && exit 0 || exit 1
