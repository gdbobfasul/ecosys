# -*- coding: utf-8 -*-
"""
mailer.py — вариант 3 „изпращане": праща писмо (тяло + по избор прикачен файл) до
събраните ИМЕЙЛИ през SMTP, с журнал за вече изпратени (дедупликация), лимит на
пускане и забавяне между писмата.

Данни за SMTP по два начина:
  • от .env (config.SMTP) — по подразбиране;
  • ПОДАДЕНИ в заявката (`smtp=…`) — така ПОТРЕБИТЕЛЯТ задава своя имейл в приложението
    и писмата тръгват от НЕГОВИЯ адрес. Подадените стойности имат приоритет над .env.

Забавяне: между две писма чакаме НАЙ-МАЛКО `delay_minutes` минути (по подразбиране 5) +
малък случаен джитър (0–90 сек), за да НЕ ни маркират като спам. Никога по-рано.

send_bulk(emails, subject, body, attachment=None, smtp=None, exclude_domains=None,
          from_name=None, reply_to=None, on_progress=None) -> dict
Забележка: изпраща само на ИМЕЙЛИ (телефони не се пращат тук).
"""
import os
import json
import time
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.header import Header
from email.utils import formataddr
from email import encoders

import config

SENT_LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sent_log.json")


def _load_sent():
    if os.path.exists(SENT_LOG):
        try:
            with open(SENT_LOG, encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()


def _save_sent(sent):
    try:
        with open(SENT_LOG, "w", encoding="utf-8") as f:
            json.dump(sorted(sent), f, ensure_ascii=False, indent=2)
    except Exception:
        pass


def _attach(msg, filepath):
    if not filepath or not os.path.exists(filepath):
        return
    with open(filepath, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f"attachment; filename={os.path.basename(filepath)}")
    msg.attach(part)


def _resolve_smtp(smtp):
    """Слива .env настройките с подадените в заявката (заявката печели)."""
    base = dict(config.SMTP)
    if smtp and isinstance(smtp, dict):
        m = {
            "user": smtp.get("user") or smtp.get("email") or base.get("user", ""),
            "password": smtp.get("password") or smtp.get("pass") or base.get("password", ""),
            "server": smtp.get("server") or smtp.get("smtp_server") or base.get("server", "smtp.gmail.com"),
            "port": int(smtp.get("port") or smtp.get("smtp_port") or base.get("port", 587)),
            "delay_minutes": int(smtp.get("delay_minutes") or base.get("delay_minutes", 5)),
            "max_per_run": int(smtp.get("max_per_run") or base.get("max_per_run", 25)),
        }
        return m
    return base


def _domain(email):
    return email.rsplit("@", 1)[-1].lower() if "@" in email else ""


def send_bulk(emails, subject, body, attachment=None, delay=True, smtp=None,
              exclude_domains=None, from_name=None, reply_to=None, on_progress=None):
    cfg = _resolve_smtp(smtp)
    if not cfg["user"] or not cfg["password"]:
        return {"ok": False, "error": "Липсват SMTP данни (scraper_email_user/pass в .env или подадени в заявката)", "sent": 0}
    if not body:
        return {"ok": False, "error": "Празно тяло на писмото", "sent": 0}

    # Минимум 5 минути между писма (искане на потребителя), за да не ни спрат за спам.
    delay_min = max(5, int(cfg.get("delay_minutes", 5)))

    excl = [d.lower() for d in (exclude_domains or [])]
    def _excluded(e):
        d = _domain(e)
        return any(x in d or x in e.lower() for x in excl)

    sent = _load_sent()
    targets = []
    skipped_excluded = 0
    for e in dict.fromkeys(emails):
        if "@" not in e or e in sent:
            continue
        if _excluded(e):
            skipped_excluded += 1
            continue
        targets.append(e)

    result = {"ok": True, "sent": 0, "skipped": len(emails) - len(targets),
              "skipped_excluded": skipped_excluded, "errors": []}

    try:
        server = smtplib.SMTP(cfg["server"], cfg["port"], timeout=30)
        server.starttls()
        server.login(cfg["user"], cfg["password"])
    except Exception as e:
        return {"ok": False, "error": f"SMTP вход: {e}", "sent": 0}

    from_hdr = formataddr((str(Header(from_name, "utf-8")), cfg["user"])) if from_name else cfg["user"]

    for email in targets:
        if result["sent"] >= cfg["max_per_run"]:
            break
        msg = MIMEMultipart()
        msg["From"] = from_hdr
        msg["To"] = email
        msg["Subject"] = str(Header(subject or "", "utf-8"))
        if reply_to:
            msg["Reply-To"] = reply_to
        msg.attach(MIMEText(body, "plain", "utf-8"))
        _attach(msg, attachment)
        try:
            server.send_message(msg)
            sent.add(email)
            _save_sent(sent)
            result["sent"] += 1
            if on_progress:
                on_progress(f"sent:{email}")
            more_to_go = (result["sent"] < len(targets)) and (result["sent"] < cfg["max_per_run"])
            if delay and more_to_go:
                # НАЙ-МАЛКО 5 мин + 0–90 сек джитър; никога по-рано.
                time.sleep(delay_min * 60 + random.randint(0, 90))
        except Exception as e:
            result["errors"].append({"email": email, "error": str(e)})
    try:
        server.quit()
    except Exception:
        pass
    return result
