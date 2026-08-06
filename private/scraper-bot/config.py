# -*- coding: utf-8 -*-
"""
config.py — чете локален .env (без задължителна зависимост python-dotenv) и дава
настройки по подразбиране. Реалните тайни (SMTP парола) стоят само в .env ЛОКАЛНО,
никога в кода. Виж .env.example.
"""
import os

def _load_env(path):
    if not os.path.exists(path):
        return
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except Exception:
        pass

_load_env(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

def get(key, default=None):
    return os.environ.get(key, default)

def get_int(key, default):
    try:
        return int(os.environ.get(key, default))
    except (TypeError, ValueError):
        return default

# ── SMTP (за изпращане на писма) — само от .env ──
SMTP = {
    "user": get("scraper_email_user", ""),
    "password": get("scraper_email_pass", ""),
    "server": get("scraper_smtp_server", "smtp.gmail.com"),
    "port": get_int("scraper_smtp_port", 587),
    "delay_minutes": get_int("scraper_delay_minutes", 20),
    "max_per_run": get_int("scraper_max_per_run", 25),
}

# ── Общи ограничения ──
DEFAULT_MAX_ITEMS = get_int("scraper_max_items", 100)
API_PORT = get_int("scraper_api_port", 3030)
API_TOKEN = get("scraper_api_token", "")  # по избор — прост Bearer токен за API
