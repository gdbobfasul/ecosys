# -*- coding: utf-8 -*-
"""
extract.py — ИЗВЛИЧАНЕ на данни от текст/HTML (вариант 2: „какво събираме").
Без външни зависимости → тества се изолирано. Поддържа:
  • emails  — имейл адреси (с чистене на боклук/картинки)
  • phones  — телефонни номера (нормализирани, 7–15 цифри)
  • both    — и двете

collect_from(text, kind) → списък от {"type": "email|phone", "value": ...}
"""
import re

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# Телефон: по избор „+", после цифри със separators (интервал/тире/точка/скоби/наклонена), 7–15 цифри общо.
PHONE_RE = re.compile(r"(?<![\w@.])(\+?\d[\d\s().\-/]{5,18}\d)(?![\w@])")

# Домейни/суфикси, които НЕ са реални контакти (боклук от кода/картинки/tracking).
JUNK_EMAIL_SUBSTR = (
    "example.com", "example.org", "sentry.", "wixpress.com", "@2x", "@3x",
    "your-email", "email@", "user@", "name@", "domain.com", "yourdomain",
    "googleapis.com", "gstatic.com", "cloudflare", "schema.org", "w3.org",
)
BAD_EMAIL_END = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".css", ".js", ".ico", ".woff", ".woff2")


def clean_emails(text):
    out = []
    for m in EMAIL_RE.findall(text or ""):
        e = m.lower().strip(".")
        if e.endswith(BAD_EMAIL_END):
            continue
        if any(j in e for j in JUNK_EMAIL_SUBSTR):
            continue
        # твърде дълъг локален/домейн = вероятно слепен боклук
        if len(e) > 100:
            continue
        out.append(e)
    return out


def _normalize_phone(raw):
    plus = raw.strip().startswith("+")
    digits = re.sub(r"\D", "", raw)
    if not (7 <= len(digits) <= 15):
        return None
    # разумно отсяване: без години/цени (напр. 8 еднакви цифри е подозрително, но не филтрираме агресивно)
    return ("+" if plus else "") + digits


def clean_phones(text):
    seen, out = set(), []
    for m in PHONE_RE.findall(text or ""):
        n = _normalize_phone(m)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def collect_from(text, kind="emails"):
    """Връща списък от {"type","value"} според kind (emails|phones|both)."""
    items = []
    if kind in ("emails", "both"):
        for e in clean_emails(text):
            items.append({"type": "email", "value": e})
    if kind in ("phones", "both"):
        for p in clean_phones(text):
            items.append({"type": "phone", "value": p})
    return items


VALID_KINDS = ("emails", "phones", "both")
