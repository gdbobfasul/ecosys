// Version: 1.0087
// Portals — Database Schema Tests
// Проверка че схемата се прилага коректно и таблиците имат очакваните колони/ограничения.

const assert = require('assert');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '../../private/portals/database/schema.sql');
const TEST_DB = path.join(__dirname, 'test-schema.db');

let db;

describe('🗄️  Portals DB — Schema', () => {

    before(() => {
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
        db = new Database(TEST_DB);
        db.pragma('foreign_keys = ON');
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);
    });

    after(() => {
        if (db) db.close();
        if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    it('schema файлът съществува', () => {
        assert.strictEqual(fs.existsSync(SCHEMA_PATH), true);
    });

    it('създава 4 очаквани таблици', () => {
        const tables = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).all().map(t => t.name);
        assert.deepStrictEqual(tables.sort(), [
            'portal_game_scores',
            'portal_monthly_payments',
            'portal_service_jobs',
            'portal_users'
        ].sort());
    });

    it('portal_users има всички необходими колони', () => {
        const cols = db.prepare("PRAGMA table_info(portal_users)").all().map(c => c.name);
        ['id', 'username', 'password_hash', 'stripe_paid_total_usd',
         'crypto_paid_btc', 'crypto_paid_eth', 'crypto_paid_bnb', 'created_at']
            .forEach(c => assert.ok(cols.includes(c), `missing column: ${c}`));
    });

    it('portal_users.username е UNIQUE', () => {
        db.prepare("INSERT INTO portal_users (username, password_hash) VALUES ('alice', 'h1')").run();
        assert.throws(
            () => db.prepare("INSERT INTO portal_users (username, password_hash) VALUES ('alice', 'h2')").run(),
            /UNIQUE/
        );
    });

    it('portal_monthly_payments.method има CHECK ограничение', () => {
        const uid = db.prepare("SELECT id FROM portal_users WHERE username='alice'").get().id;
        // valid method
        db.prepare("INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, ?, ?)")
            .run(uid, '2026-01', 'stripe', 5);
        // invalid method
        assert.throws(
            () => db.prepare("INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, ?, ?)")
                .run(uid, '2026-02', 'paypal', 5),
            /CHECK/
        );
    });

    it('portal_monthly_payments има UNIQUE(user_id, month)', () => {
        const uid = db.prepare("SELECT id FROM portal_users WHERE username='alice'").get().id;
        // first record for 2026-03 ok
        db.prepare("INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, ?, ?)")
            .run(uid, '2026-03', 'btc', 0.0001);
        // dup
        assert.throws(
            () => db.prepare("INSERT INTO portal_monthly_payments (user_id, month, method, amount) VALUES (?, ?, ?, ?)")
                .run(uid, '2026-03', 'eth', 0.001),
            /UNIQUE/
        );
    });

    it('portal_service_jobs.status има CHECK ограничение', () => {
        const uid = db.prepare("SELECT id FROM portal_users WHERE username='alice'").get().id;
        db.prepare("INSERT INTO portal_service_jobs (user_id, service, input_json, status) VALUES (?, ?, ?, ?)")
            .run(uid, 'scraper', '{}', 'done');
        assert.throws(
            () => db.prepare("INSERT INTO portal_service_jobs (user_id, service, input_json, status) VALUES (?, ?, ?, ?)")
                .run(uid, 'scraper', '{}', 'pending'),
            /CHECK/
        );
    });

    it('всички очаквани индекси са създадени', () => {
        const indexes = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
        ).all().map(i => i.name);
        ['idx_portal_users_username',
         'idx_portal_mp_user_month',
         'idx_portal_scores_game',
         'idx_portal_scores_user',
         'idx_portal_jobs_user',
         'idx_portal_jobs_service']
            .forEach(i => assert.ok(indexes.includes(i), `missing index: ${i}`));
    });
});
