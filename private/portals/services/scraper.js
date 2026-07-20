// Pupikes Portals — Web scraper service
// Version: 1.0093
//
// Flow:
//   1. 3 search-query низа → DuckDuckGo HTML search → списък URL-ове
//   2. Всеки URL се fetch-ва
//   3. Един "extraction hint" (какво да се извлече) → прост heuristic (keyword match → surrounding text)
//      Ако ANTHROPIC_API_KEY е наличен, може да се подобри с Claude post-processing.
//   4. Всичко с максимум 5 минути (конфиг) и hard cancellation.

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

function loadConfig() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'configs', 'scraper.json'), 'utf8'));
}

// ─── DDG HTML search ───────────────────────────────────────────
async function ddgSearch(query, signal, cfg) {
    const url = cfg.search_engines.duckduckgo_html + encodeURIComponent(query);
    const resp = await fetch(url, {
        headers: { 'User-Agent': cfg.user_agent, 'Accept': 'text/html' },
        signal,
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const $ = cheerio.load(html);
    const results = [];
    $('a.result__a, a.result__url').each((_, el) => {
        let href = $(el).attr('href') || '';
        // DDG HTML често връща redirect-link: //duckduckgo.com/l/?uddg=<encoded>&rut=...
        const m = href.match(/[?&]uddg=([^&]+)/);
        if (m) href = decodeURIComponent(m[1]);
        if (href.startsWith('//')) href = 'https:' + href;
        if (/^https?:\/\//.test(href)) {
            results.push({ url: href, title: $(el).text().trim() });
        }
    });
    // dedupe
    const seen = new Set();
    return results.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
    }).slice(0, cfg.max_pages_per_query);
}

// ─── Page fetch + extract ──────────────────────────────────────
async function fetchAndExtract(url, hint, signal, cfg) {
    try {
        const resp = await fetch(url, {
            headers: { 'User-Agent': cfg.user_agent, 'Accept': 'text/html,*/*;q=0.5' },
            signal,
        });
        if (!resp.ok) return { url, error: `HTTP ${resp.status}` };
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('html') && !ct.includes('text')) return { url, error: `skipped ${ct}` };

        const html = await resp.text();
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header, noscript').remove();

        const title = $('title').text().trim().slice(0, 200);
        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

        // Извличане по hint: намираме изречения, съдържащи някоя от hint-думите.
        const hintTokens = hint.toLowerCase()
            .split(/[\s,.;:!?]+/)
            .filter(w => w.length >= 3);
        const sentences = bodyText.split(/(?<=[.!?])\s+/);
        const matched = sentences.filter(s => {
            const low = s.toLowerCase();
            return hintTokens.some(t => low.includes(t));
        }).slice(0, 10);

        return {
            url,
            title,
            excerpt: matched.length ? matched.join(' ') : bodyText.slice(0, 500),
            matches: matched.length,
        };
    } catch (err) {
        return { url, error: err.name === 'AbortError' ? 'aborted' : err.message };
    }
}

/**
 * Основна функция — изпълнява скрап с таймер.
 * @param {object} p
 * @param {string[]} p.queries - до 3 заявки
 * @param {string} p.hint - какво да се извлича
 * @param {AbortSignal} [p.externalSignal]
 * @param {number} [p.maxSeconds]
 * @returns {Promise<{pages: Array, stats: object}>}
 */
async function runScrape({ queries, hint, externalSignal, maxSeconds }) {
    const cfg = loadConfig();
    const budgetMs = 1000 * (maxSeconds || cfg.max_duration_seconds);
    const ctrl = new AbortController();
    const signal = ctrl.signal;

    if (externalSignal) {
        externalSignal.addEventListener('abort', () => ctrl.abort());
    }

    const hardTimeout = setTimeout(() => ctrl.abort(), budgetMs);
    const startedAt = Date.now();
    const pages = [];

    try {
        // Събираме URL-ове от всички заявки
        const urlSet = new Set();
        const urlMeta = new Map();
        for (const q of queries.filter(Boolean).slice(0, 3)) {
            if (signal.aborted) break;
            const results = await ddgSearch(q, signal, cfg).catch(() => []);
            for (const r of results) {
                if (!urlSet.has(r.url)) {
                    urlSet.add(r.url);
                    urlMeta.set(r.url, { query: q, title: r.title });
                }
                if (urlSet.size >= cfg.max_total_pages) break;
            }
            if (urlSet.size >= cfg.max_total_pages) break;
        }

        // Fetch-ваме и extract-ваме
        for (const url of urlSet) {
            if (signal.aborted) break;
            const per = new AbortController();
            const tm = setTimeout(() => per.abort(), cfg.request_timeout_ms);
            const outerListener = () => per.abort();
            signal.addEventListener('abort', outerListener);
            const out = await fetchAndExtract(url, hint || '', per.signal, cfg);
            clearTimeout(tm);
            signal.removeEventListener('abort', outerListener);
            const meta = urlMeta.get(url) || {};
            pages.push({ ...out, source_query: meta.query, ddg_title: meta.title });
        }
    } finally {
        clearTimeout(hardTimeout);
    }

    return {
        pages,
        stats: {
            duration_ms: Date.now() - startedAt,
            pages_fetched: pages.length,
            aborted: signal.aborted,
            hint: hint || null,
            queries_used: queries.filter(Boolean).slice(0, 3),
        },
    };
}

module.exports = { runScrape, loadConfig };
