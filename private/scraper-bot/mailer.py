# -*- coding: utf-8 -*-
"""
mailer.py — вариант 3 „изпращане": праща писмо (тяло + по избор прикачен файл) до
събраните ИМЕЙЛИ през SMTP, с журнал за вече изпратени (дедупликация), лимит на
пускане и забавяне между писмата. Тайните (SMTP парола) идват от .env (config.py).

send_bulk(emails, subject, body, attachment=None, on_progress=None) -> dict
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


def send_bulk(emails, subject, body, attachment=None, delay=True, on_progress=None):
    cfg = config.SMTP
    if not cfg["user"] or not cfg["password"]:
        return {"ok": False, "error": "Липсват scraper_email_user / scraper_email_pass в .env", "sent": 0}
    if not body:
        return {"ok": False, "error": "Празно тяло на писмото", "sent": 0}

    sent = _load_sent()
    targets = [e for e in dict.fromkeys(emails) if "@" in e and e not in sent]
    result = {"ok": True, "sent": 0, "skipped": len(emails) - len(targets), "errors": []}

    try:
        server = smtplib.SMTP(cfg["server"], cfg["port"], timeout=30)
        server.starttls()
        server.login(cfg["user"], cfg["password"])
    except Exception as e:
        return {"ok": False, "error": f"SMTP вход: {e}", "sent": 0}

    for email in targets:
        if result["sent"] >= cfg["max_per_run"]:
            break
        msg = MIMEMultipart()
        msg["From"] = cfg["user"]
        msg["To"] = email
        msg["Subject"] = subject or ""
        msg.attach(MIMEText(body, "plain", "utf-8"))
        _attach(msg, attachment)
        try:
            server.send_message(msg)
            sent.add(email)
            _save_sent(sent)
            result["sent"] += 1
            if on_progress:
                on_progress(f"sent:{email}")
            if delay and result["sent"] < len(targets) and result["sent"] < cfg["max_per_run"]:
                time.sleep((cfg["delay_minutes"] + random.randint(0, 10)) * 60)
        except Exception as e:
            result["errors"].append({"email": email, "error": str(e)})
    try:
        server.quit()
    except Exception:
        pass
    return result
