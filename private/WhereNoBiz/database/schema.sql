-- Version: 1.0171
-- WhereNoBiz („Намери ми бизнес, който го няма") — PostgreSQL схема
-- ИЗЦЯЛО НОВА база (напр. wherenobiz), отделна от чата и всичко друго.
-- Числа/срокове/тарифи НЕ са тук — те са в config.json.
-- Тук пазим само СТРУКТУРАТА и правилата, които базата сама налага.

-- ═══════════════════════════════════════════════════════════════
-- 1. Потребители
--    Админ/модератор НЕ се пази тук — определя се от .env (виж roles.js):
--    имейл == WNB_ADMIN_USER → админ; имейл ∈ WNB_MOD1..5_USER → модератор.
--    Абонаментът ($1/мес) дава ГЛЕДАНЕ в приложението (флаг за прототипа).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id                    BIGSERIAL PRIMARY KEY,
    email                 TEXT NOT NULL UNIQUE,
    password_hash         TEXT NOT NULL,
    display_name          TEXT,
    lang                  TEXT NOT NULL DEFAULT 'en',

    -- Контактен телефон (показва се на други само при платено разкриване — виж posts).
    phone                 TEXT,

    is_subscribed         BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_until    TIMESTAMPTZ,

    is_banned             BOOLEAN NOT NULL DEFAULT FALSE,
    ban_reason            TEXT,
    banned_at             TIMESTAMPTZ,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wnb_users_email ON users(email);
-- Премахваме старата role колона (ако още съществува от предишна схема) — ролите
-- вече идват от .env (roles.js), не от базата. Идемпотентно.
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- ═══════════════════════════════════════════════════════════════
-- 2. Страни — списък от всички страни на земята.
--    Зарежда се веднъж (seed-countries.sql). code = ISO-3166 alpha-2.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS countries (
    code   TEXT PRIMARY KEY,            -- 'US', 'IN', 'ID', ...
    name   TEXT NOT NULL,               -- показваното име (на английски)
    emoji  TEXT                         -- знаме (по избор, за иконен UI)
);

-- ═══════════════════════════════════════════════════════════════
-- 3. Постове — „какъв бизнес НЯМА" в дадена страна.
--    status:
--      'pending_moderation' — подаден, чака модератор (нищо не е публично).
--      'approved'           — одобрен; видим; събира потвърждения.
--      'rejected'           — модераторът отказа (нелогично / червен флаг).
--      'removed'            — свален (валиден доклад / бан / собственикът изтри).
--
--    confirm_count  = брой потвърждения „такъв бизнес НЯМА" (денормализиран, за класация).
--    unlike_count   = брой „не съм съгласен" (важно за прага за разкриване на телефон).
--    phone_revealed = собственикът е платил да си покаже телефона (config.fees.revealOwnPhoneUsd),
--                     позволено само при confirm_count >= config.ranking.votesToAllowPhoneReveal.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS posts (
    id                BIGSERIAL PRIMARY KEY,
    owner_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    country_code      TEXT NOT NULL REFERENCES countries(code),

    title             TEXT NOT NULL,   -- кратко име на липсващия бизнес
    -- Дължина (≤3000) се налага в кода от config.post.maxDescriptionChars;
    -- тук държим мек таван срещу бъг.
    description       TEXT NOT NULL DEFAULT '',

    status            TEXT NOT NULL DEFAULT 'pending_moderation'
                      CHECK (status IN ('pending_moderation','approved','rejected','removed')),

    confirm_count     INTEGER NOT NULL DEFAULT 0,
    unlike_count      INTEGER NOT NULL DEFAULT 0,
    report_count      INTEGER NOT NULL DEFAULT 0,

    phone_revealed    BOOLEAN NOT NULL DEFAULT FALSE,

    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at       TIMESTAMPTZ,
    moderated_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    moderation_note   TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wnb_posts_country ON posts(country_code);
CREATE INDEX IF NOT EXISTS idx_wnb_posts_status  ON posts(status);
-- Класация ЗА СТРАНА: най-много потвърждения най-отгоре (само одобрени).
CREATE INDEX IF NOT EXISTS idx_wnb_posts_ranking ON posts(country_code, confirm_count DESC) WHERE status = 'approved';

-- ═══════════════════════════════════════════════════════════════
-- 4. Линкове на поста — към подобни сайтове в ДРУГИ страни.
--    Лимит (config.post.maxLinks) се налага в кода.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS post_links (
    id          BIGSERIAL PRIMARY KEY,
    post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    label       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wnb_links_post ON post_links(post_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. Снимки на поста (до config.post.maxImages = 30).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS post_images (
    id          BIGSERIAL PRIMARY KEY,
    post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wnb_images_post ON post_images(post_id, sort_order);

-- ═══════════════════════════════════════════════════════════════
-- 6. Потвърждения („такъв бизнес НЯМА")
--    НЕ е „харесва ми". Лайкът ИЗИСКВА обосновка:
--      where_could_develop — къде би могъл да се развие (градове/места)
--      why_missing         — защо лайкващият знае, че го няма (бедна страна, малко
--                            инвеститори, климат...).
--    stance: 'confirm' (няма го) | 'dispute' (не съм съгласен / има го).
--      'dispute' се брои в posts.unlike_count (важно за прага за телефона).
--    Един потребител — едно потвърждение на пост (config.ranking.oneConfirmationPerUserPerPost).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS confirmations (
    id                   BIGSERIAL PRIMARY KEY,
    post_id              BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id              BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stance               TEXT NOT NULL DEFAULT 'confirm'
                         CHECK (stance IN ('confirm','dispute')),
    where_could_develop  TEXT,
    why_missing          TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_wnb_conf_post ON confirmations(post_id);

-- ═══════════════════════════════════════════════════════════════
-- 7. Доклади за фалшив/нелогичен пост
--    Дори ЕДИН доклад с доказателство може да свали поста (config.moderation.oneReportTakesDown);
--    решава модератор. evidence_url = доказателство (напр. Google резултат).
--    status: 'pending' | 'valid' | 'invalid'
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reports (
    id           BIGSERIAL PRIMARY KEY,
    post_id      BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    reporter_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL,
    evidence_url TEXT,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','valid','invalid')),
    reviewed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_wnb_reports_status ON reports(status);

-- ═══════════════════════════════════════════════════════════════
-- 8. Платени достъпи до телефон (кой е платил да види телефона на даден пост)
--    config.fees.viewPhoneUsd. За прототипа плащането е заглушка.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS phone_access (
    id          BIGSERIAL PRIMARY KEY,
    post_id     BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    viewer_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (post_id, viewer_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 9. Дневник на модерацията (одит)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS moderation_log (
    id           BIGSERIAL PRIMARY KEY,
    post_id      BIGINT REFERENCES posts(id) ON DELETE SET NULL,
    target_user  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,   -- 'approve' | 'reject' | 'remove' | 'ban_owner' | ...
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wnb_modlog_post ON moderation_log(post_id);
