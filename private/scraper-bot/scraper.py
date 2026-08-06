# -*- coding: utf-8 -*-
"""
scraper.py — ЯДРО на събирача (вариант 1 „търсене в много търсачки" + вариант 2
„какво събираме"). Обхожда 14 търсачки по зададена заявка, посещава резултатните
сайтове и вади имейли и/или телефони. Playwright се внася МЪРЗЕЛИВО (само при run),
за да може server.py да стартира и без него (напр. /health).

Основно API:
    run_scrape(query, collect="emails", engines=None, max_items=100,
               headless=True, interactive=False, on_progress=None) -> list[dict]
    → всеки елемент: {"type": "email|phone", "value": str, "source": url}

Базирано на доказания scrap1_sendmails.py; тук е РАЗШИРЕНО: конфигурируем тип на
събиране, връща структурирани резултати (за API), headless/неинтерактивно за сървър.
"""
from urllib.parse import quote_plus
from extract import collect_from
import content as content_mod

# Режими на събиране: контакти (emails/phones/both) или съдържание (content/links).
COLLECT_CONTACTS = {"emails", "phones", "both"}
COLLECT_CONTENT = {"content", "links"}
ALL_COLLECT = COLLECT_CONTACTS | COLLECT_CONTENT

# ── Търсачки (директни URL-и на резултатите; SPA искат повече изчакване) ──
SEARCH_URLS = {
    "Google":      "https://www.google.com/search?q={q}&num=10",
    "Bing":        "https://www.bing.com/search?q={q}",
    "DuckDuckGo":  "https://duckduckgo.com/?q={q}&ia=web",
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
ALL_ENGINES = list(SEARCH_URLS.keys())

EXCLUDE_DOMAINS = (
    "youtube", "doi.org", "researchgate.net", "academia.edu", "scholar.google",
    "ncbi.nlm.nih.gov", "pubmed", "springer.com", "wiley.com", "sciencedirect.com",
    "jstor.org", "arxiv.org", "linkedin.com", "facebook.com", "twitter.com", "x.com",
    "instagram.com", "tiktok.com", "pinterest.com", "reddit.com", "wikipedia.org",
    "amazon.", "ebay.", "google.", "bing.com", "duckduckgo.com", "yahoo.com",
)


def _progress(cb, msg):
    if cb:
        try:
            cb(msg)
        except Exception:
            pass


def _collect_links(page, visited_domains):
    urls = []
    try:
        anchors = page.locator("a[href^='http']")
        count = anchors.count()
    except Exception:
        return urls
    for i in range(min(count, 60)):
        try:
            href = anchors.nth(i).get_attribute("href")
        except Exception:
            continue
        if not href or any(ex in href for ex in EXCLUDE_DOMAINS):
            continue
        parts = href.split("/")
        domain = parts[2] if len(parts) > 2 else ""
        if domain and domain not in visited_domains:
            visited_domains.add(domain)
            urls.append(href)
    return urls


def run_scrape(query, collect="emails", engines=None, max_items=100,
               headless=True, interactive=False, filters=None, want_types=None, on_progress=None):
    """Обхожда търсачките за `query` и събира според `collect`:
       • контакти: emails | phones | both → {type,value,source}
       • съдържание: content (текст+тип+snippet) | links (URL-та за дърво)
    `filters` (по избор, за точност/тематика): {must_all, any_of, exclude, focus, context}
       - прилага се като ГЕЙТ на всяка страница (поправя „търсачката изпусна дума").
    НЕ хвърля при мрежови грешки на отделна страница — просто продължава."""
    if collect not in ALL_COLLECT:
        collect = "emails"
    filters = filters or {}
    engines = [e for e in (engines or ALL_ENGINES) if e in SEARCH_URLS] or ALL_ENGINES

    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        raise RuntimeError("Playwright не е инсталиран. Виж requirements.txt / README.") from e

    seen = set()          # (type,value) — дедупликация
    results = []
    visited_domains = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        for engine in engines:
            if len(results) >= max_items:
                break
            _progress(on_progress, f"engine:{engine}")
            wait = SEARCH_WAIT_MS.get(engine, 3000)
            try:
                page.goto(SEARCH_URLS[engine].format(q=quote_plus(query)), timeout=25000)
                page.wait_for_timeout(wait)
            except Exception:
                _progress(on_progress, f"engine_fail:{engine}")
                continue

            if interactive:
                try:
                    input(f">>> [{engine}] CAPTCHA? Реши я и натисни Enter…")
                except EOFError:
                    pass

            for url in _collect_links(page, visited_domains):
                if len(results) >= max_items:
                    break
                try:
                    page.goto(url, timeout=30000)
                    page.wait_for_timeout(1200)
                    html = page.content()
                except Exception:
                    continue

                _process_html(html, url, collect, filters, want_types, seen, results, max_items, on_progress)
        browser.close()
    return results


def _process_html(html, url, collect, filters, want_types, seen, results, max_items, on_progress=None):
    """ГЕЙТ (точност/тематика) + събиране от една страница. Мутира seen/results."""
    info = None
    if filters:
        info = content_mod.extract(html)
        if not content_mod.relevance(info["text"], **filters)["ok"]:
            return
    if collect in COLLECT_CONTACTS:
        for item in collect_from(html, collect):
            key = (item["type"], item["value"])
            if key in seen:
                continue
            seen.add(key)
            item["source"] = url
            results.append(item)
            _progress(on_progress, f"found:{item['type']}:{item['value']}")
            if len(results) >= max_items:
                return
    else:  # content | links
        if url in seen:
            return
        seen.add(url)
        if info is None:
            info = content_mod.extract(html)
            rel = content_mod.relevance(info["text"], **filters)
            if not rel["ok"]:
                return
        else:
            rel = content_mod.relevance(info["text"], **filters)
        ctype = content_mod.classify(info["text"], info["jsonld_types"])
        if want_types and ctype not in want_types:
            return
        item = {
            "type": "content" if collect == "content" else "link",
            "title": info["title"], "contentType": ctype,
            "author": info.get("author", ""), "date": info.get("date", ""),
            "score": rel["score"], "snippet": rel["snippet"], "source": url,
        }
        if collect == "content":
            item["text"] = info["text"][:4000]
        else:
            item["value"] = url
        results.append(item)
        _progress(on_progress, f"found:{item['type']}:{ctype}")


def run_extract(urls, collect="content", filters=None, want_types=None, max_items=500,
                headless=True, on_progress=None):
    """СТЪПКА 2 на многостепенно търсене: обхожда ГОТОВ списък URL-та (без ново търсене),
       прилага същите филтри/тип и събиране. Позволява search → filter → refine вериги
       (напр. „български рецепти" → филтър „мусака" → извади авторите)."""
    if collect not in ALL_COLLECT:
        collect = "content"
    filters = filters or {}
    try:
        from playwright.sync_api import sync_playwright
    except Exception as e:
        raise RuntimeError("Playwright не е инсталиран. Виж requirements.txt / README.") from e
    seen, results = set(), []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        page = browser.new_page()
        for url in urls:
            if len(results) >= max_items:
                break
            try:
                page.goto(url, timeout=30000)
                page.wait_for_timeout(1200)
                html = page.content()
            except Exception:
                continue
            _process_html(html, url, collect, filters, want_types, seen, results, max_items, on_progress)
        browser.close()
    return results


def save_to_file(results, path):
    """Вариант 3: записва резултатите в текстов файл за сваляне."""
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# Намерени: {len(results)}\n")
        for i, r in enumerate(results, 1):
            val = r.get("value") or r.get("title") or r.get("snippet") or ""
            f.write(f"{i}. [{r.get('type')}/{r.get('contentType', '')}] {val}  <-  {r.get('source', '')}\n")
    return path


def save_csv(results, path):
    """Вариант 3: Excel-съвместима таблица (CSV, UTF-8 BOM). Колони според данните:
       контакти → type,value,source · съдържание → url,contentType,title,author,date,snippet,text."""
    import csv
    is_content = any(r.get("type") in ("content", "link") for r in results)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        if is_content:
            w.writerow(["url", "type", "title", "author", "date", "score", "snippet", "text"])
            for r in results:
                w.writerow([r.get("source", ""), r.get("contentType", ""), r.get("title", ""),
                            r.get("author", ""), r.get("date", ""), r.get("score", ""),
                            r.get("snippet", ""), (r.get("text", "") or "")[:2000]])
        else:
            w.writerow(["type", "value", "source"])
            for r in results:
                w.writerow([r.get("type", ""), r.get("value", ""), r.get("source", "")])
    return path
