-- Version: 1.0193
-- Find Best Price per Country — PostgreSQL схема (отделна база, напр. findbestprice).
-- Гео полетата (държава/град/село/район/точна локация) са СВОБОДЕН текст — въвеждат се от обекта.
-- Админ/модератор НЕ се пазят тук — определят се от .env (roles.js).

-- 1. Потребители
CREATE TABLE IF NOT EXISTS users (
    id             BIGSERIAL PRIMARY KEY,
    email          TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    display_name   TEXT,
    lang           TEXT NOT NULL DEFAULT 'en',
    is_banned      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fbp_users_email ON users(email);

-- 2. Обекти (бизнеси) — типът + ЗАДЪЛЖИТЕЛНО държава/точна локация/име; град/село/район по избор.
CREATE TABLE IF NOT EXISTS businesses (
    id             BIGSERIAL PRIMARY KEY,
    owner_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    btype          TEXT NOT NULL CHECK (btype IN ('factory','shop','stall','reseller','online')),
    name           TEXT NOT NULL,
    country        TEXT NOT NULL,
    city           TEXT,
    village        TEXT,
    district       TEXT,
    location_exact TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fbp_biz_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_fbp_biz_geo   ON businesses(country, city);

-- 3. Записи с цени. kind определя вида (категориите се валидират в кода спрямо kind):
--      'product'   — стока (12-те продуктови категории)
--      'service'   — УСЛУГА по държава (зъболекар, медицина, ремонт, юрист, производство… — идея #4)
--      'sparepart' — резервна част за СПРЯН/стар продукт (идея #3); fits_product = за кой модел/уред е
CREATE TABLE IF NOT EXISTS products (
    id            BIGSERIAL PRIMARY KEY,
    business_id   BIGINT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    kind          TEXT NOT NULL DEFAULT 'product' CHECK (kind IN ('product','service','sparepart')),
    category      TEXT NOT NULL,
    name          TEXT NOT NULL,
    price         NUMERIC(14,2) NOT NULL,
    currency      TEXT NOT NULL DEFAULT 'USD',
    quality       TEXT,
    materials     TEXT,
    manufacturer  TEXT,
    brand         TEXT,
    fits_product  TEXT,                            -- само за sparepart: за кой модел/уред пасва
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fbp_prod_kindcat ON products(kind, category);
CREATE INDEX IF NOT EXISTS idx_fbp_prod_biz     ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_fbp_prod_price   ON products(kind, category, price);
-- идемпотентен ъпгрейд на стара схема (ако базата вече съществува без новите колони):
ALTER TABLE products ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'product';
ALTER TABLE products ADD COLUMN IF NOT EXISTS fits_product TEXT;

-- FILL DATA: маркер за системно (скрапнато) съдържание + дневен брояч за скрапера.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products   ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS fbp_scraper_usage (
    day   TEXT PRIMARY KEY,            -- 'YYYY-MM-DD' (UTC)
    count INTEGER NOT NULL DEFAULT 0   -- брой Google заявки този ден (таван 3)
);

-- ═══════════════════════════════════════════════════════════════
-- ZERO PRICE („цена 0"): посетител публикува КАКВО търси, което го НЯМА в
-- неговата държава; други предлагат цена/оферта или казват КЪДЕ го има.
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS wanted_requests (
    id           BIGSERIAL PRIMARY KEY,
    requester_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,                 -- какво търси
    description  TEXT NOT NULL DEFAULT '',
    country      TEXT NOT NULL,                 -- държавата му (където липсва)
    city         TEXT,
    status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
    is_system    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wanted_offers (
    id            BIGSERIAL PRIMARY KEY,
    request_id    BIGINT NOT NULL REFERENCES wanted_requests(id) ON DELETE CASCADE,
    responder_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    price         NUMERIC(14,2),                -- по желание (може само да каже КЪДЕ го има)
    currency      TEXT DEFAULT 'USD',
    where_country TEXT,                         -- къде го има
    note          TEXT NOT NULL DEFAULT '',     -- обяснение / линк / къде
    is_system     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fbp_wanted_country ON wanted_requests(country, status);
CREATE INDEX IF NOT EXISTS idx_fbp_offers_req     ON wanted_offers(request_id);
