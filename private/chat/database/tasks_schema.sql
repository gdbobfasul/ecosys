-- Version: 1.0193
-- Чат — модул „ЗАДАЧИ" (Remote Local Hands / „Истина ли е"). Идемпотентно (IF NOT EXISTS).
-- НИЕ само дефинираме НУЖДАТА — НЕ обработваме прехвърлянето на пари между двамата.
-- Поток: draft → published → taken → in_progress → done → paid (или payment_disputed → бан).

CREATE TABLE IF NOT EXISTS tasks (
    id                BIGSERIAL PRIMARY KEY,
    author_phone      TEXT NOT NULL,                 -- кой е поставил задачата (скрит за чернови)
    type              TEXT NOT NULL DEFAULT 'local_hands'
                      CHECK (type IN ('local_hands','verify','other')),
    country           TEXT NOT NULL,                 -- държава, в която трябва да се изпълни
    city              TEXT,
    title             TEXT NOT NULL,
    content           TEXT NOT NULL DEFAULT '',       -- подробни условия
    reward_amount     NUMERIC(12,2),                 -- колко дава авторът на изпълнителя (напр. 100)
    reward_currency   TEXT NOT NULL DEFAULT 'EUR',

    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','published','taken','in_progress','done','paid','cancelled')),

    executor_phone    TEXT,                          -- кой я е хванал
    take_fee_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,  -- такса към НАС при хващане (free_mode → 0)
    take_fee_currency TEXT NOT NULL DEFAULT 'EUR',
    take_fee_paid     BOOLEAN NOT NULL DEFAULT FALSE,    -- платена ли е таксата (при free_mode=false)
    take_fee_intent   TEXT,                              -- Stripe PaymentIntent id за таксата
    chat_locked       BOOLEAN NOT NULL DEFAULT FALSE,    -- изпълнителят заключва чата → започва изпълнение

    done_report       TEXT,                          -- доклад какво е направено
    done_photo        TEXT,                          -- снимка/доказателство
    payment_disputed  BOOLEAN NOT NULL DEFAULT FALSE,    -- авторът не плати → за бан (админ)

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at      TIMESTAMPTZ,
    taken_at          TIMESTAMPTZ,
    done_at           TIMESTAMPTZ,
    paid_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_country  ON tasks(country);
CREATE INDEX IF NOT EXISTS idx_tasks_author   ON tasks(author_phone);
CREATE INDEX IF NOT EXISTS idx_tasks_executor ON tasks(executor_phone);

-- Чат между автора и изпълнителя по конкретна задача (заключва се при изпълнение).
CREATE TABLE IF NOT EXISTS task_messages (
    id            BIGSERIAL PRIMARY KEY,
    task_id       BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    sender_phone  TEXT NOT NULL,
    text          TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_msgs ON task_messages(task_id, created_at);
