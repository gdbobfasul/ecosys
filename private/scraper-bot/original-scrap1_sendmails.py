import os
import re
import json
import time
import random
import smtplib
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from urllib.parse import quote_plus
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright
load_dotenv()
# ─── Настройки от .env ───
scrap1_email_user = os.getenv("scrap1_email_user")
scrap1_email_pass = os.getenv("scrap1_email_pass")
scrap1_smtp_server = os.getenv("scrap1_smtp_server", "smtp.gmail.com")
scrap1_smtp_port = int(os.getenv("scrap1_smtp_port", "587"))
scrap1_subject = os.getenv("scrap1_subject", "Anfrage")
scrap1_mailbody = os.getenv("scrap1_mailbody", "")
scrap1_attachment = os.getenv("scrap1_attachment", "")
scrap1_search1 = os.getenv("scrap1_search1", "")
scrap1_search2 = os.getenv("scrap1_search2", "")
scrap1_search3 = os.getenv("scrap1_search3", "")
scrap1_delay_minutes = int(os.getenv("scrap1_delay_minutes", "20"))
scrap1_maxemail_per_search = int(os.getenv("scrap1_maxemail_per_search", "150"))
scrap1_delay_seconds = 600
scrap1_max_per_run = 25

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
scrap1_full_result = os.path.join(SCRIPT_DIR, os.path.basename(os.getenv("scrap1_full_result", "res1.txt")))
scrap1_mails_result = os.path.join(SCRIPT_DIR, os.path.basename(os.getenv("scrap1_mails_result", "res2.txt")))

print(f"[INIT] Файлове ще се записват в:")
print(f"  {scrap1_full_result}")
print(f"  {scrap1_mails_result}")
sys.stdout.flush()

# Събери заявките (пропусни празни)
SEARCH_QUERIES = [q for q in [scrap1_search1, scrap1_search2, scrap1_search3] if q]
# ─── Търсачки ───
SEARCH_ENGINES = [
    {
        "name": "Google",
        "url": "https://www.google.de/?hl=de",
        "input": "textarea[name='q'], input[name='q']",
        "results": "div#search a[href^='http'], div#rso a[href^='http']",
        "next": "a#pnnext, a[aria-label='Next'], a:has-text('Weiter'), a:has-text('Next')",
        "cookies": "button:has-text('Accept all'), button:has-text('Alle akzeptieren'), button:has-text('Alle annehmen'), button:has-text('Kabul Et')",
        "exclude": ["google"],
    },
    {
        "name": "Bing",
        "url": "https://www.bing.com/?setlang=de",
        "input": "input[name='q'], textarea[name='q']",
        "results": "#b_results a[href^='http']",
        "next": "a.sb_pagN, a[title='Next page'], a:has-text('Weiter')",
        "cookies": "button#bnp_btn_accept, button:has-text('Accept')",
        "exclude": ["bing", "microsoft"],
    },
    {
        "name": "DuckDuckGo",
        "url": "https://duckduckgo.com/?kl=de-de",
        "input": "input[name='q']",
        "results": "a[data-testid='result-title-a'], article a[href^='http'], .result__a",
        "next": "button#more-results, button:has-text('More results'), button:has-text('Weitere')",
        "cookies": "",
        "exclude": ["duckduckgo"],
    },
    {
        "name": "Yahoo",
        "url": "https://search.yahoo.com/",
        "input": "input[name='p']",
        "results": "#web a[href^='http'], .algo a[href^='http']",
        "next": "a.next, a:has-text('Next')",
        "cookies": "button:has-text('Accept all'), button:has-text('Agree')",
        "exclude": ["yahoo"],
    },
    {
        "name": "Ecosia",
        "url": "https://www.ecosia.org/?l=de",
        "input": "input[name='q']",
        "results": ".result a[href^='http'], .mainline-results a[href^='http']",
        "next": "a[aria-label='next page'], a:has-text('Next'), a:has-text('Weiter')",
        "cookies": "button:has-text('Accept'), button:has-text('Akzeptieren')",
        "exclude": ["ecosia"],
    },
    {
        "name": "Startpage",
        "url": "https://www.startpage.com/?lui=deutsch",
        "input": "input[name='query']:visible, input[id='q']:visible, input[type='search']:visible",
        "results": ".w-gl__result a[href^='http'], .result a[href^='http']",
        "next": "button:has-text('Next'), a:has-text('Next'), button:has-text('Weiter')",
        "cookies": "button:has-text('OK'), button:has-text('Accept')",
        "exclude": ["startpage"],
    },
    {
        "name": "Brave",
        "url": "https://search.brave.com/",
        "input": "input#searchbox, input[name='q'], input[type='search'], textarea[name='q']",
        "results": "#results a[href^='http'], .snippet a[href^='http'], a[href^='http'].result-header",
        "next": "a:has-text('Next'), button:has-text('Next')",
        "cookies": "",
        "exclude": ["brave"],
    },
    {
        "name": "Mojeek",
        "url": "https://www.mojeek.com/",
        "input": "input[name='q']",
        "results": ".results-standard a[href^='http'], .result a[href^='http']",
        "next": "a:has-text('Next'), a.pagination-next",
        "cookies": "",
        "exclude": ["mojeek"],
    },
    {
        "name": "Ask",
        "url": "https://www.ask.com/",
        "input": "input[name='q']",
        "results": ".PartialSearchResults-item a[href^='http'], .result a[href^='http']",
        "next": "a:has-text('Next'), li.PartialWebPagination-next a",
        "cookies": "button:has-text('Accept'), button:has-text('Agree')",
        "exclude": ["ask.com"],
    },
    {
        "name": "Yep",
        "url": "https://yep.com/",
        "input": "input[type='search'], input[name='q']",
        "results": ".result a[href^='http'], a[href^='http']",
        "next": "a:has-text('Next'), button:has-text('Next')",
        "cookies": "",
        "exclude": ["yep.com"],
    },
    {
        "name": "Dogpile",
        "url": "https://www.dogpile.com/",
        "input": "input[name='q']",
        "results": ".web-bing__result a[href^='http'], .result a[href^='http']",
        "next": "a:has-text('Next')",
        "cookies": "",
        "exclude": ["dogpile"],
    },
    {
        "name": "Metacrawler",
        "url": "https://www.metacrawler.com/",
        "input": "input[name='q']",
        "results": ".web-bing__result a[href^='http'], .result a[href^='http']",
        "next": "a:has-text('Next')",
        "cookies": "",
        "exclude": ["metacrawler"],
    },
    {
        "name": "Swisscows",
        "url": "https://swisscows.com/en/",
        "input": "input[name='query'], input[name='q'], input[type='search']",
        "results": ".web-results a[href^='http'], .result a[href^='http']",
        "next": "button:has-text('Next'), a:has-text('Next')",
        "cookies": "",
        "exclude": ["swisscows"],
    },
    {
        "name": "Gibiru",
        "url": "https://gibiru.com/",
        "input": "input[name='q'], input[type='search']",
        "results": ".gsc-results a[href^='http'], .result a[href^='http']",
        "next": "a:has-text('Next')",
        "cookies": "",
        "exclude": ["gibiru"],
    },
]

# ─── ДИРЕКТНИ URL-и на търсенето (фикс: „някои търсачки не се отваряха") ───
# Вместо да пишем в полето за търсене (чупливо при SPA/скрити полета/бот-защити),
# отиваме направо на страницата с резултатите. Старият начин остава като резерва.
# {q} = URL-кодираната заявка. SPA търсачките (Yep/Swisscows/Gibiru/Ecosia) искат
# повече изчакване — виж SEARCH_WAIT_MS.
SEARCH_URLS = {
    "Google":      "https://www.google.de/search?q={q}&hl=de&num=10",
    "Bing":        "https://www.bing.com/search?q={q}&setlang=de",
    "DuckDuckGo":  "https://duckduckgo.com/?q={q}&kl=de-de&ia=web",
    "Yahoo":       "https://search.yahoo.com/search?p={q}",
    "Ecosia":      "https://www.ecosia.org/search?q={q}",
    "Startpage":   "https://www.startpage.com/sp/search?query={q}",
    "Brave":       "https://search.brave.com/search?q={q}",
    "Mojeek":      "https://www.mojeek.com/search?q={q}",
    "Ask":         "https://www.ask.com/web?q={q}",
    "Yep":         "https://yep.com/web?q={q}",
    "Dogpile":     "https://www.dogpile.com/serp?q={q}",
    "Metacrawler": "https://www.metacrawler.com/serp?q={q}",
    "Swisscows":   "https://swisscows.com/de/web?query={q}",
    "Gibiru":      "https://gibiru.com/results.html?q={q}",
}
SEARCH_WAIT_MS = {"Yep": 5000, "Swisscows": 5000, "Gibiru": 5000, "Ecosia": 4000, "DuckDuckGo": 3500, "Brave": 3500}


def save_incremental(results):
    """Записва резултатите веднага — вика се след всяка посетена страница с имейли."""
    print(f"  [SAVE] Записвам {len(results)} имейла...", flush=True)

    try:
        with open(scrap1_full_result, "w", encoding="utf-8") as f:
            f.write(f"Намерени уникални имейли: {len(results)}\n")
            f.write("=" * 60 + "\n\n")
            for i, c in enumerate(results, 1):
                f.write(f"{i}. {c['email']}\n")
                f.write(f"   Източник: {c['source']}\n\n")
        print(f"  [SAVE] ✓ {scrap1_full_result}", flush=True)
    except Exception as e:
        print(f"  [SAVE] ✗ ГРЕШКА res1: {e}", flush=True)

    try:
        emails = [c['email'] for c in results]
        with open(scrap1_mails_result, "w", encoding="utf-8") as f:
            for i in range(0, len(emails), 3):
                f.write(", ".join(emails[i:i+3]) + "\n")
        print(f"  [SAVE] ✓ {scrap1_mails_result}", flush=True)
    except Exception as e:
        print(f"  [SAVE] ✗ ГРЕШКА res2: {e}", flush=True)


def read_body():
    if not scrap1_mailbody:
        print("ГРЕШКА: scrap1_mailbody не е зададен в .env")
        return None
    if not os.path.exists(scrap1_mailbody):
        print(f"ГРЕШКА: Файлът {scrap1_mailbody} не съществува")
        return None
    with open(scrap1_mailbody, "r", encoding="utf-8") as f:
        return f.read()


def attach_file(msg, filepath):
    if not filepath or not os.path.exists(filepath):
        return
    filename = os.path.basename(filepath)
    with open(filepath, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f"attachment; filename={filename}")
    msg.attach(part)
    print(f"  Прикачен файл: {filename}")


def collect_page_links(page, engine, all_visited_domains):
    result_links = page.locator(engine["results"])
    count = result_links.count()
    if count == 0:
        result_links = page.locator("a[href^='http']")
        count = result_links.count()
    urls = []
    exclude = engine["exclude"] + ["youtube", "doi.org", "researchgate.net", "academia.edu",
        "scholar.google", "ncbi.nlm.nih.gov", "pubmed", "springer.com", "wiley.com",
        "sciencedirect.com", "jstor.org", "arxiv.org", "linkedin.com", "facebook.com",
        "twitter.com", "instagram.com", "tiktok.com", "pinterest.com", "reddit.com",
        "wikipedia.org", "amazon.", "ebay."]
    for i in range(count):
        try:
            href = result_links.nth(i).get_attribute("href")
            if href and not any(ex in href for ex in exclude):
                domain = href.split("/")[2] if len(href.split("/")) > 2 else ""
                if domain and domain not in all_visited_domains:
                    all_visited_domains.add(domain)
                    urls.append(href)
        except:
            continue
    return urls


def accept_cookies(page, engine):
    if engine["cookies"]:
        try:
            accept_btn = page.locator(engine["cookies"])
            if accept_btn.count() > 0:
                accept_btn.first.click()
                page.wait_for_timeout(1000)
        except:
            pass


def search_with_engine(page, engine, query, found_emails, results, all_visited_domains, query_email_count):
    print(f"\n  ▶ Търсачка: {engine['name']}", flush=True)
    wait_ms = SEARCH_WAIT_MS.get(engine["name"], 3000)

    # 1) ПЪРВО: директно на URL-а на търсенето (отваря и „упоритите" търсачки).
    opened = False
    direct = SEARCH_URLS.get(engine["name"])
    if direct:
        try:
            page.goto(direct.format(q=quote_plus(query)), timeout=25000)
            page.wait_for_timeout(wait_ms)
            accept_cookies(page, engine)
            opened = True
        except Exception as e:
            print(f"  Директният URL за {engine['name']} не се отвори ({e}); пробвам през полето…")

    # 2) РЕЗЕРВА: старият начин — начална страница + писане в полето за търсене.
    if not opened:
        try:
            page.goto(engine["url"], timeout=15000)
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"  Не може да отвори {engine['name']}: {e}")
            return query_email_count
        accept_cookies(page, engine)
        try:
            search_input = page.locator(engine["input"])
            if search_input.count() == 0:
                print(f"  Не намери поле за търсене в {engine['name']}")
                return query_email_count
            search_input.first.fill(query)
            search_input.first.press("Enter")
            page.wait_for_timeout(wait_ms)
        except Exception as e:
            print(f"  Грешка при търсене в {engine['name']}: {e}")
            return query_email_count

    # Пауза за ръчна капча (както преди) — Enter продължава.
    try:
        input(f">>> [{engine['name']}] CAPTCHA? Реши я и натисни Enter...")
    except EOFError:
        pass
    page.wait_for_timeout(1500)

    page_num = 0
    pages_without_new = 0
    while query_email_count < scrap1_maxemail_per_search:
        page_num += 1
        print(f"\n  --- {engine['name']} стр. {page_num} (имейли: {query_email_count}/{scrap1_maxemail_per_search}) ---", flush=True)
        urls_to_visit = collect_page_links(page, engine, all_visited_domains)
        print(f"  Нови уникални сайтове: {len(urls_to_visit)}", flush=True)

        if len(urls_to_visit) == 0:
            pages_without_new += 1
            if pages_without_new >= 3:
                print(f"  3 страници без нови сайтове, сменям търсачка.")
                break
        else:
            pages_without_new = 0

        search_results_url = page.url

        for url in urls_to_visit:
            emails_found_on_page = []

            try:
                print(f"  Посещение: {url}", flush=True)
                page.goto(url, timeout=30000)
                page.wait_for_timeout(1500)
                content = page.content()
                emails_raw = re.findall(
                    r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
                    content
                )
                for email in emails_raw:
                    email_lower = email.lower()
                    if not email_lower.endswith((".png", ".jpg", ".gif", ".svg", ".css", ".js")) \
                            and email_lower not in found_emails:
                        found_emails.add(email_lower)
                        results.append({"source": url, "email": email_lower})
                        emails_found_on_page.append(email_lower)
                        query_email_count += 1
                        print(f"    ✓ {email_lower} ({query_email_count}/{scrap1_maxemail_per_search})", flush=True)
                        if query_email_count >= scrap1_maxemail_per_search:
                            break
            except Exception as e:
                print(f"  Грешка при {url}: {e}", flush=True)

            # ── ЗАПИС е извън try/except — не може да бъде потиснат ──
            if emails_found_on_page:
                save_incremental(results)

            if query_email_count >= scrap1_maxemail_per_search:
                break

        if query_email_count >= scrap1_maxemail_per_search:
            print(f"\n  ✓ Достигнати {query_email_count} имейла!", flush=True)
            break

        try:
            page.goto(search_results_url)
            page.wait_for_timeout(2000)
            next_btn = page.locator(engine["next"])
            if next_btn.count() > 0:
                next_btn.first.click()
                page.wait_for_timeout(3000)
            else:
                print(f"  Няма повече страници в {engine['name']}.")
                break
        except:
            print(f"  Грешка при навигация в {engine['name']}.")
            break

    return query_email_count


def scrape_emails(existing_emails=None):
    if not SEARCH_QUERIES:
        print("ГРЕШКА: Няма зададени заявки (scrap1_search1/2/3) в .env")
        return []
    results = []
    found_emails = set(existing_emails) if existing_emails else set()
    all_visited_domains = set()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        for query in SEARCH_QUERIES:
            print(f"\n{'='*60}")
            print(f"ЗАЯВКА: {query}")
            print(f"Цел: {scrap1_maxemail_per_search} имейла")
            print(f"{'='*60}", flush=True)
            query_email_count = 0
            for engine in SEARCH_ENGINES:
                if query_email_count >= scrap1_maxemail_per_search:
                    break
                query_email_count = search_with_engine(
                    page, engine, query,
                    found_emails, results, all_visited_domains,
                    query_email_count
                )
            print(f"\n  Общо за тази заявка: {query_email_count} имейла", flush=True)
        browser.close()
    return results


def save_results(companies):
    save_incremental(companies)
    print(f"\nФайлове записани:")
    print(f"  {scrap1_full_result} - пълна информация ({len(companies)} имейла)")
    print(f"  {scrap1_mails_result} - имейли по 3 на ред")


def send_emails(companies):
    body_text = read_body()
    if body_text is None:
        return
    if not scrap1_email_user or not scrap1_email_pass:
        print("ГРЕШКА: scrap1_email_user и scrap1_email_pass трябва да са в .env")
        return
    sent_log = "scrap1_sent_log.json"
    if os.path.exists(sent_log):
        with open(sent_log, "r") as f:
            sent = json.load(f)
    else:
        sent = []
    server = smtplib.SMTP(scrap1_smtp_server, scrap1_smtp_port)
    server.starttls()
    server.login(scrap1_email_user, scrap1_email_pass)
    sent_count = 0
    for company in companies:
        if sent_count >= scrap1_max_per_run:
            break
        if company['email'] in sent:
            continue
        msg = MIMEMultipart()
        msg['From'] = scrap1_email_user
        msg['To'] = company['email']
        msg['Subject'] = scrap1_subject
        msg.attach(MIMEText(body_text, 'plain', 'utf-8'))
        attach_file(msg, scrap1_attachment)
        try:
            server.send_message(msg)
            print(f"  ✓ Изпратено до: {company['email']}")
            sent.append(company['email'])
            sent_count += 1
            with open(sent_log, "w") as f:
                json.dump(sent, f, indent=2)
            jitter = random.randint(0, 10)
            wait = scrap1_delay_minutes + jitter
            print(f"  Изчакване {wait} минути...")
            time.sleep(wait * 60)
        except Exception as e:
            print(f"  ✗ Грешка: {e}")
    server.quit()
    print(f"\n{'='*60}")
    print(f"Готово! Изпратени: {sent_count} писма")


if __name__ == "__main__":
    print("Събиране на контакти...")
    existing_companies = []
    existing_emails = set()
    if os.path.exists(scrap1_mails_result):
        with open(scrap1_mails_result, "r", encoding="utf-8") as f:
            for line in f:
                for part in line.strip().split(","):
                    email = part.strip()
                    if "@" in email:
                        existing_emails.add(email)
    if os.path.exists(scrap1_full_result):
        with open(scrap1_full_result, "r", encoding="utf-8") as f:
            current_email = None
            current_source = None
            for line in f:
                line = line.strip()
                if "@" in line and not line.startswith("Източник:") and not line.startswith("="):
                    current_email = re.sub(r"^\d+\.\s*", "", line).strip()
                elif line.startswith("Източник:"):
                    current_source = line.replace("Източник:", "").strip()
                    if current_email and current_email in existing_emails:
                        existing_companies.append({
                            "source": current_source,
                            "email": current_email
                        })
                    current_email = None
                    current_source = None
    if existing_emails:
        print(f"  Заредени {len(existing_emails)} съществуващи имейла")
    companies = scrape_emails(existing_emails)
    all_companies = existing_companies + companies
    print(f"\nНамерени уникални имейли: {len(all_companies)} (нови: {len(companies)})")
    save_results(all_companies)
    print("\nЗа изпращане на писма, разкоментирай send_emails(companies)")
    # send_emails(companies)