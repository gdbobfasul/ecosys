// KCY Portals — Anthropic AI service
// Version: 1.0086
//
// Генерира обява за продажба на имот по зададени няколко думи.
// Използва ANTHROPIC_API_KEY от private/configs/.env

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 800;

let _client = null;
function getClient() {
    if (_client) return _client;
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.startsWith('sk-ant-your_')) {
        throw new Error('ANTHROPIC_API_KEY is not configured in private/configs/.env');
    }
    _client = new Anthropic({ apiKey });
    return _client;
}

/**
 * Генерира обява за продажба на имот.
 * @param {string} keywords - Няколко думи описващи имота (напр. "3-стаен апартамент Лозенец 85кв с тераса")
 * @param {object} [opts]
 * @param {string} [opts.language='bg']
 * @param {string} [opts.tone='professional']
 * @returns {Promise<{text: string, model: string, input_tokens: number, output_tokens: number}>}
 */
async function generateListing(keywords, opts = {}) {
    const language = opts.language || 'bg';
    const tone = opts.tone || 'professional';

    if (typeof keywords !== 'string' || keywords.trim().length < 3) {
        throw new Error('keywords must be a non-empty string (minimum 3 chars)');
    }

    const client = getClient();
    const systemPrompt = language === 'bg'
        ? 'Ти си професионален брокер на недвижими имоти. Пиши на български. Създавай стегнати, атрактивни обяви за продажба — заглавие, 2–3 параграфа описание, bullet списък с ключови предимства, и финален CTA. Не измисляй фактическа информация — ако нещо не е посочено, не го споменавай.'
        : 'You are a professional real-estate copywriter. Produce concise, compelling listings — title, 2–3 paragraph description, bullet list of key features, and a closing CTA. Do not invent facts; if unspecified, omit.';

    const userPrompt = language === 'bg'
        ? `Напиши обява за продажба на имот. Тон: ${tone}.\n\nКлючови думи / детайли:\n${keywords.trim()}`
        : `Write a real-estate for-sale listing. Tone: ${tone}.\n\nKeywords / details:\n${keywords.trim()}`;

    const resp = await client.messages.create({
        model: MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    });

    const text = resp.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n\n');

    return {
        text,
        model: resp.model,
        input_tokens: resp.usage?.input_tokens || 0,
        output_tokens: resp.usage?.output_tokens || 0,
    };
}

module.exports = { generateListing, MODEL };
