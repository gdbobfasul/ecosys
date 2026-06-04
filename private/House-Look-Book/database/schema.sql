-- Version: 1.0171
-- House-Look-Book (Подреди своя дом) — PostgreSQL схема
-- ИЗЦЯЛО НОВА база (напр. houselookbook), отделна от чата и всичко друго.
-- Числа/срокове/тарифи НЕ са тук — те са в config.json.
-- Тази схема пази само СТРУКТУРАТА и правилата, които базата сама налага.

-- ═══════════════════════════════════════════════════════════════
-- 1. Потребители
--    Един и същ абонамент дава И гледане, И предлагане (няма разлика).
--    Админ/модератор НЕ се пази тук — определя се от .env (виж roles.js):
--    имейл == HLB_ADMIN_USER → админ; имейл ∈ HLB_MOD1..5_USER → модератор.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
    id                    BIGSERIAL PRIMARY KEY,
    email                 TEXT NOT NULL UNIQUE,
    password_hash         TEXT NOT NULL,
    display_name          TEXT,
    lang                  TEXT NOT NULL DEFAULT 'en',

    -- Абонамент (за прототипа е флаг; реалният Stripe идва по-късно)
    is_subscribed         BOOLEAN NOT NULL DEFAULT FALSE,
    subscription_until    TIMESTAMPTZ,

    -- Бан на акаунта (виж reports по-долу)
    is_banned             BOOLEAN NOT NULL DEFAULT FALSE,
    ban_reason            TEXT,
    banned_at             TIMESTAMPTZ,

    -- Брояч на НЕОСНОВАТЕЛНИ доклади, които този човек е подал.
    -- Над прага (config.reports.maxBaselessReportsBeforeReporterBan) → модератор може да го банне.
    baseless_report_count INTEGER NOT NULL DEFAULT 0,

    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
-- Премахваме старата role колона (ролите идват от .env, roles.js). Идемпотентно.
ALTER TABLE users DROP COLUMN IF EXISTS role;

-- ═══════════════════════════════════════════════════════════════
-- 2. Предложения (къщи)
--    Машина на състоянията (status):
--      'editing'            — прозорецът за редакция е отворен; собственикът пипа свободно;
--                             НИКОЙ друг не го вижда, модерация НЕ се прави още.
--      'pending_moderation' — прозорецът изтече; чака модератор.
--      'approved'           — одобрено; видимо публично; влиза в класацията.
--      'rejected'           — модераторът отказа.
--      'removed'            — свалено (валиден доклад / бан / собственикът изтри).
--
--    edit_window_until: докато now() < тази дата → 'editing'.
--      Първоначално created_at + config.editWindow.initialDays (7 дни).
--      Всяка редакция (дори на одобрено) го мести на now() + perEditDays (2 дни)
--      и връща status на 'editing' → после пак 'pending_moderation' → пак модерация.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS proposals (
    id                BIGSERIAL PRIMARY KEY,
    owner_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    title             TEXT NOT NULL,
    -- Дължината (≤4000) се налага в кода от config.proposals.maxDescriptionChars;
    -- тук държим мек таван, за да не гръмне базата при бъг.
    description       TEXT NOT NULL DEFAULT '',

    -- Ако къщата е сглобена в конструктора — параметрите ѝ (форма/покрив/цвят/стаи).
    -- Ако е качена като снимки — оставаме NULL.
    composer_params   JSONB,

    status            TEXT NOT NULL DEFAULT 'editing'
                      CHECK (status IN ('editing','pending_moderation','approved','rejected','removed')),

    like_count        INTEGER NOT NULL DEFAULT 0,   -- денормализирано за бърза класация
    report_count      INTEGER NOT NULL DEFAULT 0,

    edit_window_until TIMESTAMPTZ NOT NULL,          -- докога е свободна редакцията
    submitted_at      TIMESTAMPTZ,                   -- кога е влязло за модерация
    approved_at       TIMESTAMPTZ,
    moderated_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    moderation_note   TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposals_owner   ON proposals(owner_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status  ON proposals(status);
-- Класация: най-много лайкове най-отгоре (само одобрени).
CREATE INDEX IF NOT EXISTS idx_proposals_ranking ON proposals(like_count DESC) WHERE status = 'approved';
-- Фонов процес търси изтекли 'editing' по тази дата.
CREATE INDEX IF NOT EXISTS idx_proposals_window  ON proposals(edit_window_until) WHERE status = 'editing';

-- ═══════════════════════════════════════════════════════════════
-- 3. Картинки на предложението
--    kind:
--      'view'   — основните външни изгледи (изисквани 4 по config.proposals.requiredExteriorViews)
--      'detail' — допълнителни умалени картинки (до 100 по config.proposals.maxDetailImages)
--    Лимитите се налагат в кода; sort_order пази подредбата.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS proposal_images (
    id           BIGSERIAL PRIMARY KEY,
    proposal_id  BIGINT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL CHECK (kind IN ('view','detail')),
    url          TEXT NOT NULL,           -- път до умалената картинка на диска
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pimages_proposal ON proposal_images(proposal_id, kind, sort_order);

-- ═══════════════════════════════════════════════════════════════
-- 4. Лайкове (глас „едно от най-добрите")
--    Един потребител — един лайк на предложение (config.ranking.oneLikePerUserPerProposal).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS likes (
    id           BIGSERIAL PRIMARY KEY,
    proposal_id  BIGINT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_proposal ON likes(proposal_id);

-- ═══════════════════════════════════════════════════════════════
-- 5. Доклади за нереално/неуместно предложение
--    Само за „това не е къща" (напр. магаре), НЕ за „не ми харесва".
--    status: 'pending' | 'valid' | 'invalid'
--      'valid'   → собственикът на предложението се банва (config.reports.validReportBansProposer),
--                  предложението става 'removed'.
--      'invalid' → +1 към baseless_report_count на докладващия; над прага → модератор може да го банне.
--    Един потребител — един доклад на предложение (config.reports.oneReportPerUserPerProposal).
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reports (
    id           BIGSERIAL PRIMARY KEY,
    proposal_id  BIGINT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    reporter_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason       TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','valid','invalid')),
    reviewed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (proposal_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ═══════════════════════════════════════════════════════════════
-- 6. Дневник на модерацията (одит — кой какво е направил)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS moderation_log (
    id           BIGSERIAL PRIMARY KEY,
    proposal_id  BIGINT REFERENCES proposals(id) ON DELETE SET NULL,
    target_user  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    actor_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action       TEXT NOT NULL,   -- 'approve' | 'reject' | 'remove' | 'ban_owner' | 'ban_reporter' | ...
    note         TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_modlog_proposal ON moderation_log(proposal_id);

-- ═══════════════════════════════════════════════════════════════
-- 7. Дневен брояч на Google Custom Search заявки (предпазител от такси)
--    Сървърът спира под безплатния лимит (100/ден) — виж moderation.js.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS google_usage (
    day    DATE PRIMARY KEY,
    count  INTEGER NOT NULL DEFAULT 0
);
