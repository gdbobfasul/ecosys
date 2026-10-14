# -*- coding: utf-8 -*-
"""
campaign.py — „кампания за адвокат": обхожда търсачките за адвокати по НАСЛЕДСТВЕНО
право (Fachanwalt für Erbrecht) в Берлин и близки/по-големи градове в Германия,
събира имейлите, ИЗКЛЮЧВА посочените кантори, записва CSV и (по избор) изпраща
немското писмо (letters/erbrecht.de.txt) с пауза НАЙ-МАЛКО 5 мин между писмата.

Всичко минава през СЪЩИЯ бот (scraper.py + mailer.py) — не е отделен скрипт-еднодневка.
Внасяемо е (run_campaign) → server.py излага /campaign; или се пуска от конзолата:

    python campaign.py               # DRY-RUN: само събира + записва results.csv + preview
    python campaign.py --send        # НАИСТИНА изпраща (иска зададено scraper_sender_name)
    python campaign.py --send --max 50 --headful

По подразбиране е DRY-RUN, за да прегледаш уловените имейли и писмото ПРЕДИ изпращане.
"""
import os
import sys
import json
import time
import random

import config
import scraper
import mailer

BASE = os.path.dirname(os.path.abspath(__file__))
LETTERS = os.path.join(BASE, "letters")

# Изключени кантори (по искане на потребителя) — по домейн И по име.
EXCLUDE_DOMAINS = ["adjulex.com", "adjulex", "kanzlei-freyer.berlin", "kanzlei-freyer", "freyer"]

# Берлин (основно) + близки градове в Бранденбург + по-големи германски градове.
CITIES = [
    "Berlin",
    "Potsdam", "Cottbus", "Frankfurt (Oder)", "Brandenburg an der Havel",
    "Oranienburg", "Bernau bei Berlin", "Falkensee", "Königs Wusterhausen", "Eberswalde",
    "Hamburg", "Hannover", "Leipzig", "Dresden", "Magdeburg",
    "München", "Köln", "Frankfurt am Main", "Stuttgart", "Nürnberg",
]

# Заявки на град — насочени към контакти на кантори по наследствено право. Държим ги МАЛКО
# на брой (DDG limit-ва при серия), но силни — всяка връща до 12 кантори.
QUERY_TEMPLATES = [
    'Fachanwalt Erbrecht {city} Kanzlei Kontakt Impressum',
    'Rechtsanwalt Erbrecht {city} Kanzlei E-Mail',
]

# Явен боклук/несмислени за писмо адреси (освен чистенето в extract.py).
JUNK_MARKERS = (
    "noreply", "no-reply", "donotreply", "example.", "@example", "sentry.", "wixpress",
    "@sentry", "@wix", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", "@2x",
    "your-email", "email@", "@domain", "@email", "user@", "test@", "@test.",
    "postmaster@", "abuse@", "@googlemail", "@google.com", "@google", "@facebook",
    "@sentry.io", "defiant.com", "wordfence", "@wordpress", "@wp.", "dpo-", "dpo@",
    "@s-d-r.org", "@datev.de", "@e-recht24", "hello@", "@caniuse",
    # камари/агенции/съюзи — не поемат дела (не са цел за писмото)
    "@rak-", "rechtsanwaltskammer", "@brak.de", "@dav.de", "anwaltverein",
    "@w3internet", "webdesign", "webmaster@", "@jimdo", "@strato", "@ionos",
)

# Предпочитани локални части (пращаме на общата кутия на кантората, не на 10 клона).
PREFERRED_LOCAL = ("info", "kanzlei", "berlin", "kontakt", "mail", "office", "sekretariat", "recht")
MAX_PER_DOMAIN = 2  # най-много N адреса от една и съща кантора (домейн)


# За немска кампания приемаме само правдоподобни TLD-та (маха малформирани извлечения като
# „n@def.omfcthkdbwca.bd" и чужди адреси).
ALLOWED_TLDS = ("de", "com", "eu", "berlin", "net", "org", "info", "legal", "law",
                "koeln", "hamburg", "ruhr", "bayern", "de.com")
EXTRA_JUNK = ("polarismedia", "multi-page", "@def.", "webflow", "@1und1", "@web.de.")


def _is_junk(email):
    e = email.lower()
    if e.count("@") != 1:
        return True
    local, _, dom = e.partition("@")
    if not dom or "." not in dom or len(local) < 2:
        return True
    tld = dom.rsplit(".", 1)[-1]
    if tld not in ALLOWED_TLDS:
        return True
    return any(m in e for m in JUNK_MARKERS) or any(m in e for m in EXTRA_JUNK)


def _excluded(email):
    e = email.lower()
    return any(x in e for x in EXCLUDE_DOMAINS)


def _domain_of(email):
    return email.rsplit("@", 1)[-1].lower()


def _cap_per_domain(emails_map):
    """Оставя най-много MAX_PER_DOMAIN адреса на домейн, с предпочитание към общите кутии."""
    by_dom = {}
    for e, src in emails_map.items():
        by_dom.setdefault(_domain_of(e), []).append((e, src))
    out = {}
    for dom, lst in by_dom.items():
        def rank(pair):
            local = pair[0].split("@", 1)[0]
            for i, pref in enumerate(PREFERRED_LOCAL):
                if local.startswith(pref):
                    return i
            return len(PREFERRED_LOCAL)
        for e, src in sorted(lst, key=rank)[:MAX_PER_DOMAIN]:
            out[e] = src
    return out


def wait_for_ddg(max_wait_min=90, on_progress=None):
    """Изчаква DDG да ни отблокира (след burst limit) — пробва тестова заявка на всеки ~60с.
       Връща True щом върне резултати, или False след max_wait_min минути."""
    probe = "Fachanwalt Erbrecht Berlin Kanzlei"
    deadline = time.time() + max_wait_min * 60
    tries = 0
    while time.time() < deadline:
        tries += 1
        if scraper.ddg_search(probe, max_links=3, retries=0):
            if on_progress:
                on_progress(f"ddg_ready:after_{tries}_tries")
            return True
        if on_progress:
            on_progress(f"ddg_blocked:wait:{tries}")
        time.sleep(60 + random.randint(0, 30))
    return False


def collect_lawyer_emails(cities=None, per_query_max=40, headless=True, on_progress=None):
    """BROWSER-FREE добив: за всеки град/заявка → DuckDuckGo HTML (POST) дава URL-та на
       кантори → посещаваме Impressum/Kontakt и вадим имейлите. Без Playwright (браузърът
       се засича като бот и търсачките връщат окастрени/captcha страници). Връща чист,
       дедупликиран списък (без изключените кантори, без боклук, капнат по домейн)."""
    cities = cities or CITIES
    emails = {}      # email -> source url
    seen_domains_visited = set()
    first = True
    for city in cities:
        for tmpl in QUERY_TEMPLATES:
            q = tmpl.format(city=city)
            if not first:
                time.sleep(25 + random.randint(0, 15))  # голяма пауза → DDG да не ни limit-ва при серия
            first = False
            if on_progress:
                on_progress(f"query:{q}")
            for firm_url in scraper.ddg_search(q, max_links=12):
                dom = _domain_of(firm_url.replace("://", "@")) if "@" not in firm_url else ""
                netloc = scraper.urlparse(firm_url).netloc.lower()
                if netloc in seen_domains_visited or _excluded(netloc):
                    continue
                seen_domains_visited.add(netloc)
                try:
                    found = scraper.harvest_site_emails(firm_url)
                except Exception:
                    found = set()
                for val in found:
                    val = (val or "").strip().strip(".,;)").lower()
                    if not val or _is_junk(val) or _excluded(val):
                        continue
                    emails.setdefault(val, firm_url)
                    if on_progress:
                        on_progress(f"email:{val}")
    return _cap_per_domain(emails)


def _load_letter():
    def rd(name, default=""):
        p = os.path.join(LETTERS, name)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                return f.read()
        return default
    subject = rd("erbrecht.subject.txt").strip()
    body = rd("erbrecht.de.txt")
    return subject, body


def _fill(body, subject):
    sender_name = config.get("scraper_sender_name", "").strip()
    sender_email = config.SMTP.get("user", "")
    body = body.replace("{SENDER_NAME}", sender_name or "[ВАШЕТО ИМЕ — задай scraper_sender_name]")
    body = body.replace("{SENDER_EMAIL}", sender_email)
    return subject, body, sender_name, sender_email


def run_campaign(send=False, cities=None, per_query_max=40, max_send=None,
                 headless=True, attachment=None, on_progress=None):
    """Пълната кампания: събери → запиши CSV → (по избор) изпрати немското писмо.
       DRY-RUN (send=False) не праща нищо — само връща уловените имейли + пътя до CSV."""
    subject, body_raw = _load_letter()
    subject, body, sender_name, sender_email = _fill(body_raw, subject)

    # Изчакай DDG да ни отблокира (ако сме на limit от предишна серия), преди да хабим заявки.
    if not wait_for_ddg(on_progress=on_progress):
        return {"ok": False, "error": "DDG не се отблокира навреме — опитай пак по-късно.", "found": 0}

    emails_map = collect_lawyer_emails(cities=cities, per_query_max=per_query_max,
                                       headless=headless, on_progress=on_progress)
    # ПАЗИ реда на градовете (Берлин пръв) — важно при таван за една нощ; без азбучно сортиране.
    emails = list(emails_map.keys())

    # запиши CSV за преглед
    rows = [{"type": "email", "value": e, "source": emails_map[e]} for e in emails]
    csv_path = scraper.save_csv(rows, os.path.join(BASE, "lawyers.csv"))

    out = {
        "ok": True, "found": len(emails), "emails": emails, "csv": csv_path,
        "subject": subject, "letter_preview": body[:600],
        "excluded_firms": EXCLUDE_DOMAINS, "sender_name": sender_name or None,
    }

    if not send:
        out["dry_run"] = True
        out["note"] = "DRY-RUN: нищо не е изпратено. Прегледай lawyers.csv и писмото; после пусни със send=True."
        return out

    if not sender_name:
        out["ok"] = False
        out["error"] = "Няма подател: задай scraper_sender_name в .env (иначе писмото ще е с [ВАШЕТО ИМЕ])."
        return out

    if not emails:
        out["ok"] = False
        out["error"] = "Няма събрани имейли за изпращане."
        return out

    to_send = emails[:max_send] if max_send else emails
    res = mailer.send_bulk(
        to_send, subject, body,
        attachment=attachment,
        exclude_domains=EXCLUDE_DOMAINS,
        from_name=sender_name,
        reply_to=sender_email,
        on_progress=on_progress,
    )
    out["send_result"] = res
    out["ok"] = bool(res.get("ok"))
    return out


def _cli():
    send = "--send" in sys.argv
    headful = "--headful" in sys.argv
    max_send = None
    if "--max" in sys.argv:
        try:
            max_send = int(sys.argv[sys.argv.index("--max") + 1])
        except Exception:
            max_send = None
    def prog(m):
        print("  ·", m)
    print(f"[campaign] режим: {'ИЗПРАЩАНЕ' if send else 'DRY-RUN (само събиране)'} | "
          f"градове: {len(CITIES)} | headless={not headful}")
    r = run_campaign(send=send, headless=not headful, max_send=max_send, on_progress=prog)
    print(json.dumps({k: v for k, v in r.items() if k != "emails"}, ensure_ascii=False, indent=2))
    print(f"Уловени имейли: {r.get('found')} → {r.get('csv')}")
    if send and r.get("send_result"):
        print("Изпратени:", r["send_result"].get("sent"), "| грешки:", len(r["send_result"].get("errors", [])))


if __name__ == "__main__":
    _cli()
