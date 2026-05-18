// Version: 1.0087
// Portals — Database CRUD Tests
// Тества реалните SQL заявки от auth.js, billing.js, games.js.
// Ако някоя заявка се счупи, тестът ще ни каже преди да стигне до продукция.

const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '../../private/portals/database/schema.sql');
const TEST_DB = path.join(__dirname, 'test-crud.db');

let db;

function freshDb() {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const d = new Database(TEST_DB);
    d.pragma('foreign_keys = ON');
    d.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    return d;
}

describe('🗄️  Portals DB — CRUD (real app queries)', () => {

    before(() => { db = freshDb(); });
    after(() => {
        if (db) db.close();
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    // --- auth.js: register flow ---
    describe('👤 User registration (auth.js)', () => {
        it('първа регистрация е успешна', () => {
            const existing = db.prepare("SELECT id FROM portal_users WHERE username = ?").get('mucy');
            assert.strictEqual(existing, undefined);
            const info = db.prepare(
                "INSERT INTO portal_users (username, password_hash) VALUES (?, ?)"
            ).run('mucy', '$2b$10$fakehash');
            assert.strictEqual(info.changes, 1);
            assert.ok(info.lastInsertRowid > 0);
        });

        it('повторна регистрация със същ username се проваля', () => {
            assert.throws(
                () => db.prepare("INSERT INTO portal_users (username, password_hash) VALUES (?, ?)")
                    .run('mucy', '$2b$10$other'),
                /UNIQUE/
            );
        });

        it('login lookup намира потребителя', () => {
            const user = db.prepare(
                "SELECT id, username, password_hash FROM portal_users WHERE username = ?"
            ).get('mucy');
            assert.ok(user);
            assert.strictEqual(user.username, 'mucy');
            assert.strictEqual(user.password_hash, '$2b$10$fakehash');
        });

        it('me endpoint връща пълен профил', () => {
            const userId = db.prepare("SELECT id FROM portal_users WHERE username = ?").get('mucy').id;
            const user = db.prepare(
                "SELECT id, username, stripe_paid_total_usd, crypto_paid_btc, crypto_paid_eth, crypto_paid_bnb, created_at FROM portal_users WHERE id = ?"
            ).get(userId);
            assert.strictEqual(user.username, 'mucy');
            assert.strictEqual(user.stripe_paid_total_usd, 0);
            assert.strictEqual(user.crypto_paid_btc, 0);
            assert.ok(user.created_at);
        });
    });

    // --- billing.js: monthly payment flow ---
    describe('💳 Monthly payments (billing.js)', () => {
        let userId;
        before(() => {
            userId = db.prepare("SELECT id FROM portal_users WHERE username = 'mucy'").get().id;
        });

        it('първоначално няма платен месец', () => {
            const paid = db.prepare(
                "SELECT method, amount, tx_reference, paid_at FROM portal_monthly_payments WHERE user_id = ? AND month = ?"
            ).get(userId, '2026-05');
            assert.strictEqual(paid, undefined);
        });

        it('записва stripe плащане', () => {
            db.prepare(
                "INSERT INTO portal_monthly_payments (user_id, month, method, amount, tx_reference) VALUES (?, ?, ?, ?, ?)"
            ).run(userId, '2026-05', 'stripe', 9.99, 'pi_test_123');
            db.prepare("UPDATE portal_users SET stripe_paid_total_usd = stripe_paid_total_usd + ? WHERE id = ?")
                .run(9.99, userId);

            const paid = db.prepare(
                "SELECT method, amount, tx_reference FROM portal_monthly_payments WHERE user_id = ? AND month = ?"
            ).get(userId, '2026-05');
            assert.strictEqual(paid.method, 'stripe');
            assert.strictEqual(paid.amount, 9.99);
            assert.strictEqual(paid.tx_reference, 'pi_test_123');

            const totalUsd = db.prepare("SELECT stripe_paid_total_usd FROM portal_users WHERE id = ?")
                .get(userId).stripe_paid_total_usd;
            assert.strictEqual(totalUsd, 9.99);
        });

        it('двойно плащане за същия месец се проваля (UNIQUE)', () => {
            assert.throws(
                () => db.prepare(
                    "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, ?, ?)"
                ).run(userId, '2026-05', 'btc', 0.001),
                /UNIQUE/
            );
        });

        it('crypto плащане в различен месец е ОК', () => {
            db.prepare(
                "INSERT INTO portal_monthly_payments (user_id, month, method, amount, tx_reference) VALUES (?, ?, ?, ?, ?)"
            ).run(userId, '2026-06', 'btc', 0.0001, 'tx_btc_abc');
            db.prepare("UPDATE portal_users SET crypto_paid_btc = crypto_paid_btc + ? WHERE id = ?")
                .run(0.0001, userId);
            const btc = db.prepare("SELECT crypto_paid_btc FROM portal_users WHERE id = ?")
                .get(userId).crypto_paid_btc;
            assert.strictEqual(btc, 0.0001);
        });

        it('admin_grant създава запис с amount=0', () => {
            db.prepare(
                "INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, 'admin_grant', 0)"
            ).run(userId, '2026-07');
            const paid = db.prepare(
                "SELECT method, amount FROM portal_monthly_payments WHERE user_id = ? AND month = ?"
            ).get(userId, '2026-07');
            assert.strictEqual(paid.method, 'admin_grant');
            assert.strictEqual(paid.amount, 0);
        });
    });

    // --- games.js: score submission & leaderboard ---
    describe('🎮 Game scores (games.js)', () => {
        let userId;
        before(() => {
            userId = db.prepare("SELECT id FROM portal_users WHERE username = 'mucy'").get().id;
        });

        it('записва резултат от игра', () => {
            const info = db.prepare(
                "INSERT INTO portal_game_scores (user_id, game_slug, score, level) VALUES (?, ?, ?, ?)"
            ).run(userId, 'plane-dodge', 1500, 3);
            assert.strictEqual(info.changes, 1);
        });

        it('leaderboard query работи (JOIN с users)', () => {
            // няколко резултата
            db.prepare("INSERT INTO portal_game_scores (user_id, game_slug, score, level) VALUES (?, ?, ?, ?)")
                .run(userId, 'plane-dodge', 2500, 5);
            db.prepare("INSERT INTO portal_game_scores (user_id, game_slug, score, level) VALUES (?, ?, ?, ?)")
                .run(userId, 'plane-dodge', 800, 2);

            const rows = db.prepare(`
                SELECT s.score, s.level, s.created_at, u.username
                FROM portal_game_scores s
                LEFT JOIN portal_users u ON u.id = s.user_id
                WHERE s.game_slug = ?
                ORDER BY s.score DESC
                LIMIT 10
            `).all('plane-dodge');

            assert.strictEqual(rows.length, 3);
            assert.strictEqual(rows[0].score, 2500);
            assert.strictEqual(rows[0].username, 'mucy');
            assert.strictEqual(rows[2].score, 800);
        });

        it('user_id=NULL е позволено (анонимни резултати след DELETE на user)', () => {
            // games.js има `user_id INTEGER` без NOT NULL → guest score allowed
            db.prepare("INSERT INTO portal_game_scores (user_id, game_slug, score) VALUES (NULL, ?, ?)")
                .run('hero-run', 100);
            const row = db.prepare(
                "SELECT score FROM portal_game_scores WHERE game_slug = ? AND user_id IS NULL"
            ).get('hero-run');
            assert.strictEqual(row.score, 100);
        });
    });

    // --- FK cascade behavior ---
    // Тези тестове ползват :memory: DB за изолация — за да не пипат
    // споделения test-crud.db файл (Windows EBUSY при unlink на отворен файл).
    describe('🔗 Foreign key cascades', () => {
        function memDb() {
            const d = new Database(':memory:');
            d.pragma('foreign_keys = ON');
            d.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
            return d;
        }

        it('DELETE user изтрива monthly payments (CASCADE)', () => {
            const local = memDb();
            try {
                const r = local.prepare("INSERT INTO portal_users (username, password_hash) VALUES ('bob', 'h')").run();
                const uid = r.lastInsertRowid;
                local.prepare("INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, ?, ?)")
                    .run(uid, '2026-04', 'stripe', 9.99);
                assert.strictEqual(
                    local.prepare("SELECT COUNT(*) c FROM portal_monthly_payments WHERE user_id = ?").get(uid).c,
                    1
                );
                local.prepare("DELETE FROM portal_users WHERE id = ?").run(uid);
                assert.strictEqual(
                    local.prepare("SELECT COUNT(*) c FROM portal_monthly_payments WHERE user_id = ?").get(uid).c,
                    0
                );
            } finally { local.close(); }
        });

        it('DELETE user → game_scores.user_id = NULL (SET NULL)', () => {
            const local = memDb();
            try {
                const r = local.prepare("INSERT INTO portal_users (username, password_hash) VALUES ('charlie', 'h')").run();
                const uid = r.lastInsertRowid;
                local.prepare("INSERT INTO portal_game_scores (user_id, game_slug, score) VALUES (?, ?, ?)")
                    .run(uid, 'plane-dodge', 500);
                local.prepare("DELETE FROM portal_users WHERE id = ?").run(uid);
                const row = local.prepare("SELECT user_id, score FROM portal_game_scores WHERE game_slug = ?")
                    .get('plane-dodge');
                assert.strictEqual(row.user_id, null);
                assert.strictEqual(row.score, 500);
            } finally { local.close(); }
        });
    });
});
