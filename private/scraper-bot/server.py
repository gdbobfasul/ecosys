# -*- coding: utf-8 -*-
"""
server.py — HTTP JSON API за приложението (без външни зависимости — stdlib http.server).
Свързва трите варианта:
  1) търсене (много търсачки)  → POST /scrape
  2) какво събираме            → полето `collect` в /scrape (emails|phones|both)
  3) обработка на резултата     → app-ът решава: показва ги (получава JSON), сваля файл
                                  (POST /scrape с save=true → и връща path), или изпраща
                                  писма (POST /send).

Ендпойнти:
  GET  /health                 → {ok, playwright: bool}
  POST /scrape {query, collect?, engines?, max?, headless?, save?}
                                → {ok, count, results:[{type,value,source}], file?}
  POST /send   {emails|items, subject, body, attachment?, delay?}
                                → {ok, sent, skipped, errors}

Защита (по избор): ако scraper_api_token е зададен в .env, всяка заявка иска
`Authorization: Bearer <token>`. Замислено да върви ЛОКАЛНО/зад nginx, не публично
без токен. ЗАБЕЛЕЖКА: /scrape е дълъг (синхронен) — за продукция сложи опашка от задачи.
"""
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import config
import scraper
import mailer


def _has_playwright():
    try:
        import playwright  # noqa: F401
        return True
    except Exception:
        return False


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self):
        if not config.API_TOKEN:
            return True
        auth = self.headers.get("Authorization", "")
        return auth == f"Bearer {config.API_TOKEN}"

    def _body(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return {}

    def log_message(self, *a):  # тих лог
        pass

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if self.path.rstrip("/") == "/health":
            return self._send(200, {"ok": True, "playwright": _has_playwright()})
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if not self._authorized():
            return self._send(401, {"ok": False, "error": "unauthorized"})
        path = self.path.split("?")[0].rstrip("/")
        data = self._body()

        if path == "/scrape":
            query = (data.get("query") or "").strip()
            if not query:
                return self._send(400, {"ok": False, "error": "липсва query"})
            collect = data.get("collect", "emails")
            engines = data.get("engines")
            max_items = min(int(data.get("max", config.DEFAULT_MAX_ITEMS)), 500)
            headless = bool(data.get("headless", True))
            # филтри за точност/тематика: {must_all, any_of, exclude, focus, context}
            # + готови групи: {exclude_topics, any_topics, must_topics} (напр. ["crime"]).
            raw = data.get("filters") or {}
            filters = {k: raw[k] for k in ("must_all", "any_of", "exclude", "focus", "context") if raw.get(k)}
            import content as _c
            if raw.get("exclude_topics"):
                filters["exclude"] = list(filters.get("exclude", [])) + _c.expand_topics(raw["exclude_topics"])
            if raw.get("any_topics"):
                filters["any_of"] = list(filters.get("any_of", [])) + _c.expand_topics(raw["any_topics"])
            if raw.get("must_topics"):
                filters["must_all"] = list(filters.get("must_all", [])) + _c.expand_topics(raw["must_topics"])
            want_types = data.get("types") or None  # напр. ["recipe","classified"] → само тези
            try:
                results = scraper.run_scrape(query, collect=collect, engines=engines,
                                             max_items=max_items, headless=headless,
                                             filters=filters, want_types=want_types)
            except RuntimeError as e:
                return self._send(503, {"ok": False, "error": str(e)})
            except Exception as e:
                return self._send(500, {"ok": False, "error": str(e)})
            out = {"ok": True, "count": len(results), "results": results}
            save = data.get("save")
            if save:
                base = os.path.dirname(os.path.abspath(__file__))
                if save == "csv" or data.get("format") == "csv":
                    out["file"] = scraper.save_csv(results, os.path.join(base, "results.csv"))
                else:
                    out["file"] = scraper.save_to_file(results, os.path.join(base, "results.txt"))
            return self._send(200, out)

        if path == "/extract":
            urls = [u for u in (data.get("urls") or []) if isinstance(u, str) and u.startswith("http")]
            if not urls:
                return self._send(400, {"ok": False, "error": "липсват urls"})
            collect = data.get("collect", "content")
            raw = data.get("filters") or {}
            filters = {k: raw[k] for k in ("must_all", "any_of", "exclude", "focus", "context") if raw.get(k)}
            import content as _c
            for src, dst in (("exclude_topics", "exclude"), ("any_topics", "any_of"), ("must_topics", "must_all")):
                if raw.get(src):
                    filters[dst] = list(filters.get(dst, [])) + _c.expand_topics(raw[src])
            want_types = data.get("types") or None
            max_items = min(int(data.get("max", config.DEFAULT_MAX_ITEMS)), 500)
            try:
                results = scraper.run_extract(urls, collect=collect, filters=filters,
                                              want_types=want_types, max_items=max_items)
            except RuntimeError as e:
                return self._send(503, {"ok": False, "error": str(e)})
            except Exception as e:
                return self._send(500, {"ok": False, "error": str(e)})
            out = {"ok": True, "count": len(results), "results": results}
            if data.get("save"):
                base = os.path.dirname(os.path.abspath(__file__))
                out["file"] = (scraper.save_csv(results, os.path.join(base, "results.csv"))
                               if (data.get("save") == "csv" or data.get("format") == "csv")
                               else scraper.save_to_file(results, os.path.join(base, "results.txt")))
            return self._send(200, out)

        if path == "/send":
            emails = data.get("emails")
            if not emails and data.get("items"):
                emails = [i.get("value") for i in data["items"] if i.get("type") == "email"]
            emails = [e for e in (emails or []) if e and "@" in e]
            if not emails:
                return self._send(400, {"ok": False, "error": "няма имейли за изпращане"})
            res = mailer.send_bulk(
                emails,
                data.get("subject", ""),
                data.get("body", ""),
                attachment=data.get("attachment"),
                delay=bool(data.get("delay", True)),
            )
            return self._send(200 if res.get("ok") else 400, res)

        self._send(404, {"ok": False, "error": "not found"})


def main():
    port = config.API_PORT
    srv = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"scraper-bot API на порт {port} (playwright={_has_playwright()}, token={'да' if config.API_TOKEN else 'не'})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    main()
