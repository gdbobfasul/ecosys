# -*- coding: utf-8 -*-
"""
content.py — „лека логика" за СЪДЪРЖАНИЕ (не само контакти). Без платен LLM, без
външни зависимости (stdlib html.parser + re) → тества се изолирано.

Дава:
  • extract(html) → {title, text, jsonld_types}  (readability-lite: маха script/nav/footer…)
  • classify(text, jsonld_types) → тип на съдържанието: recipe|news|event|object|product|other
  • relevance(text, must_all, any_of, exclude, focus, context) → {ok, score, snippet}
        - must_all : ВСИЧКИ думи трябва да ги има (поправя „Google изпусна дума")
        - exclude  : ако някоя се среща → отпада
        - focus+context : целевата дума (focus) трябва да е В ЕДНО ИЗРЕЧЕНИЕ с контекст
                          (напр. „пластмаса" + „конструкция"), а не случайно → тематична конкретика
        - връща и snippet-а (изречението-доказателство) → конкретика, не 200 линка
"""
import re
import json
from html.parser import HTMLParser

_SKIP = {"script", "style", "noscript", "nav", "header", "footer", "aside", "form", "svg", "template"}


class _Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.skip_stack = []
        self.parts = []
        self.title = None
        self._in_title = False
        self._in_ld = False
        self.ld_chunks = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "script" and a.get("type", "").lower() == "application/ld+json":
            self._in_ld = True
        if tag in _SKIP:
            self.skip_stack.append(tag)
        elif tag == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag == "script":
            self._in_ld = False
        if self.skip_stack and self.skip_stack[-1] == tag:
            self.skip_stack.pop()
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_ld:
            self.ld_chunks.append(data)
            return
        if self.skip_stack:
            return
        if self._in_title and not self.title:
            self.title = data.strip()
        s = data.strip()
        if s:
            self.parts.append(s)


def _jsonld_types(chunks):
    types = []
    for c in chunks:
        try:
            data = json.loads(c)
        except Exception:
            continue
        stack = [data]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                t = node.get("@type")
                if isinstance(t, str):
                    types.append(t.lower())
                elif isinstance(t, list):
                    types.extend(str(x).lower() for x in t)
                stack.extend(node.values())
            elif isinstance(node, list):
                stack.extend(node)
    return types


def _jsonld_field(chunks, keys):
    """Вади първата намерена стойност за някой от `keys` от JSON-LD (author/datePublished…)."""
    for c in chunks:
        try:
            data = json.loads(c)
        except Exception:
            continue
        stack = [data]
        while stack:
            n = stack.pop()
            if isinstance(n, dict):
                for k in keys:
                    if k in n:
                        v = n[k]
                        if isinstance(v, dict):
                            v = v.get("name") or v.get("@id")
                        elif isinstance(v, list) and v:
                            v = v[0].get("name") if isinstance(v[0], dict) else v[0]
                        if isinstance(v, str) and v.strip():
                            return v.strip()
                stack.extend(n.values())
            elif isinstance(n, list):
                stack.extend(n)
    return ""


_META_AUTHOR = re.compile(r"""<meta[^>]+(?:name|property)=["'](?:author|article:author|og:author)["'][^>]+content=["']([^"']+)""", re.I)
_REL_AUTHOR = re.compile(r"""<a[^>]+rel=["']author["'][^>]*>([^<]{2,60})</a>""", re.I)
_TXT_AUTHOR = re.compile(r"(?:Автор|Author|Публикувано от|Автор на рецептата|By)\s*[:\-–]?\s*([A-ZА-ЯЁ][\wА-Яа-яЁё.\-]+(?:\s+[A-ZА-ЯЁ][\wА-Яа-яЁё.\-]+){0,2})")
_META_DATE = re.compile(r"""<meta[^>]+(?:name|property)=["'](?:article:published_time|datePublished|date|og:updated_time)["'][^>]+content=["']([^"']+)""", re.I)


def _author_from_html(html):
    for rx in (_META_AUTHOR, _REL_AUTHOR, _TXT_AUTHOR):
        m = rx.search(html or "")
        if m:
            return m.group(1).strip()
    return ""


def extract(html):
    p = _Extractor()
    try:
        p.feed(html or "")
    except Exception:
        pass
    text = re.sub(r"\s+", " ", " ".join(p.parts)).strip()
    author = _jsonld_field(p.ld_chunks, ("author",)) or _author_from_html(html)
    date = _jsonld_field(p.ld_chunks, ("datePublished", "dateCreated"))
    if not date:
        m = _META_DATE.search(html or "")
        date = m.group(1).strip() if m else ""
    return {"title": p.title or "", "text": text, "jsonld_types": _jsonld_types(p.ld_chunks),
            "author": author, "date": date}


# ── Класификация на типа съдържание (евристики bg/en) ──
_QTY = re.compile(r"\b\d+[.,]?\d*\s?(?:г|гр|мл|кг|л|бр|с\.?л\.?|ч\.?л\.?|грам|ml|g|kg|cups?|tbsp|tsp|oz)\b", re.I)
# Десетки типове съдържание — всеки с висок-сигнални думи (bg/en). classify() взима
# типа с най-много попадения (праг ≥2). Списъкът е разширяем — добавяш ред с думи.
_SIGNALS = {
    "recipe": ["съставки", "продукти", "приготвяне", "рецепта", "разбъркайте", "изпечете", "нарежете", "тесто", "фурна",
               "ingredients", "directions", "instructions", "recipe", "preheat", "bake", "stir", "serves"],
    "news": ["според", "съобщи", "репортер", "информира", "заяви", "новина", "news", "reported", "according to", "reuters", "press", "breaking"],
    "event": ["ще се проведе", "вход", "билети", "часа", "програма", "концерт", "фестивал", "programme", "event", "tickets", "venue", "lineup", "admission"],
    "realestate": ["кв.м", "кв. м", "застроена площ", "площ", "етаж", "спалн", "апартамент", "имот", "m²", "sq m", "bedrooms", "floor area"],
    "product": ["гаранция", "спецификаци", "доставка", "добави в количката", "warranty", "specifications", "add to cart", "in stock", "buy now", "в наличност"],
    "classified": ["обява", "продавам", "купувам", "състояние", "договаряне", "за продан", "оглед", "спешно", "classified", "for sale", "negotiable", "used", "listing"],
    "sale_desc": ["продава се", "предлагаме", "на промоция", "намаление", "оригинален", "цена", "for sale", "we offer", "brand new", "discount", "price"],
    "job": ["търсим", "изисквания", "заплата", "длъжност", "позиция", "кандидатствай", "автобиография", "пълен работен ден", "hiring", "salary", "requirements", "apply", "job", "position", "full-time"],
    "medical": ["симптоми", "лечение", "диагноза", "дозировка", "странични ефекти", "лекарство", "профилактика", "заболяване", "терапия", "пациент", "болест",
                "symptoms", "treatment", "diagnosis", "dosage", "side effects", "disease", "therapy", "patient", "medication"],
    "review": ["оценка", "звезди", "плюсове", "минуси", "препоръчвам", "ревю", "отзив", "тествахме", "rating", "pros", "cons", "review", "recommend", "verdict"],
    "howto": ["как да", "стъпка", "стъпки", "ръководство", "урок", "инструкции", "направи си сам", "how to", "step", "tutorial", "guide", "diy"],
    "legal": ["член", "закон", "договор", "съгласно", "разпоредба", "страните", "клауза", "article", "law", "contract", "pursuant", "clause", "hereby", "agreement"],
    "finance": ["акция", "инвестиция", "дивидент", "борса", "лихва", "печалба", "портфейл", "stock", "investment", "dividend", "interest rate", "market", "portfolio", "earnings"],
    "sports": ["мач", "резултат", "отбор", "гол", "шампионат", "победа", "първенство", "match", "score", "team", "goal", "championship", "league"],
    "obituary": ["почина", "опело", "поклон", "съболезнования", "ще се помни", "passed away", "funeral", "obituary", "in memory", "condolences"],
    "biography": ["роден", "образование", "кариера", "завършил", "известен с", "born", "education", "career", "graduated", "known for", "biography"],
    "definition": ["е вид", "представлява", "дефиниция", "означава", "се отнася до", "is a type of", "refers to", "definition", "is defined as"],
    "qa": ["отговор", "коментар", "тема", "мнение", "въпрос", "форум", "answer", "comment", "thread", "forum", "replied"],
    "travel": ["хотел", "дестинация", "забележителности", "резервация", "полет", "пътеводител", "hotel", "destination", "attractions", "booking", "flight", "itinerary"],
    "menu": ["меню", "ястия", "предястие", "основно", "десерт", "супи", "салати", "menu", "appetizer", "main course", "dessert", "dishes"],
    "company": ["еик", "за нас", "контакти", "седалище", "дейност", "ооД", "еоод", "company", "about us", "headquarters", "established", "our mission"],
    "course": ["курс", "обучение", "записване", "сертификат", "лекции", "модул", "преподавател", "course", "enroll", "certificate", "lessons", "module", "syllabus"],
    "vehicle": ["пробег", "двигател", "скорости", "конски сили", "бензин", "дизел", "автомобил", "mileage", "engine", "transmission", "fuel", "horsepower", "petrol", "diesel"],
    "rent": ["под наем", "наем", "депозит", "обзаведен", "месечно", "for rent", "rent", "deposit", "furnished", "monthly", "lease"],
    "announcement": ["съобщение", "обявление", "уведомяваме", "notice", "announcement", "we inform", "hereby notify"],
    "interview": ["интервю", "разговор с", "в разговор", "разказва пред", "interview", "in conversation", "tells us", "talks about"],
    "opinion": ["според мен", "смятам", "редакционен", "коментар на", "opinion", "i think", "editorial", "column", "commentary"],
    "story": ["разказ", "глава", "героят", "продължение", "story", "chapter", "novel", "once upon"],
    "warning": ["внимание", "опасност", "предупреждение", "безопасност", "риск", "warning", "danger", "caution", "safety", "hazard"],
    "manual": ["спецификация", "параметри", "инсталация", "употреба", "наръчник", "manual", "specifications", "parameters", "installation", "usage"],
    "faq": ["чзв", "често задавани", "въпроси и отговори", "faq", "frequently asked"],
}
_LD_MAP = {
    "recipe": "recipe", "newsarticle": "news", "article": "news", "reportagenewsarticle": "news", "blogposting": "news",
    "event": "event", "product": "product", "offer": "sale_desc", "house": "realestate", "singlefamilyresidence": "realestate",
    "apartment": "realestate", "realestatelisting": "realestate", "jobposting": "job", "medicalwebpage": "medical",
    "medicalcondition": "medical", "drug": "medical", "medicalscholarlyarticle": "medical", "review": "review",
    "userreview": "review", "howto": "howto", "qapage": "qa", "faqpage": "faq", "course": "course", "vehicle": "vehicle",
    "car": "vehicle", "motorcycle": "vehicle", "localbusiness": "company", "organization": "company", "corporation": "company",
    "restaurant": "menu", "menu": "menu", "touristattraction": "travel", "tripitinerary": "travel", "legislation": "legal",
    "jobposition": "job", "person": "biography",
}


def classify(text, jsonld_types=None):
    for t in (jsonld_types or []):
        if t in _LD_MAP:
            return _LD_MAP[t]
    lc = (text or "").lower()
    scores = {}
    for kind, words in _SIGNALS.items():
        scores[kind] = sum(1 for w in words if w in lc)
    if _QTY.search(text or ""):
        scores["recipe"] = scores.get("recipe", 0) + 2
    best = max(scores, key=scores.get) if scores else "other"
    return best if scores.get(best, 0) >= 2 else "other"


# ── Готови тематични групи (за page-level изключване/изискване с един клик) ──
# Ползване: подаваш име на група (напр. "crime") и то се разгъва до думите.
# „Изключи crime" → страница с която и да е от думите ОТПАДА цялата (не само изречение).
# „Изисквай crime" (any_of) → страница БЕЗ нито една от думите отпада (напр. оръжеен магазин).
TOPICS = {
    "crime": ["убийство", "убиец", "убий", "престъпление", "престъпник", "улика", "жертва", "разследване",
              "murder", "killer", "crime", "criminal", "victim", "evidence", "homicide"],
    "weapons": ["оръжие", "пистолет", "пушка", "патрон", "боеприпас", "нож за", "weapon", "gun", "rifle", "pistol", "ammo", "firearm"],
    "adult": ["порно", "секс", "18+", "еротика", "porn", "sex", "xxx", "nude", "escort"],
    "gambling": ["казино", "залог", "хазарт", "ротативк", "букмейкър", "casino", "betting", "gambling", "poker", "slots"],
    "politics": ["избори", "партия", "депутат", "правителство", "election", "party", "parliament", "government", "politician"],
    "violence": ["насилие", "убий", "кръв", "нападение", "violence", "assault", "blood", "attack"],
    "drugs": ["наркотик", "дрога", "хероин", "кокаин", "drug", "narcotic", "heroin", "cocaine"],
}


def expand_topics(names):
    """Разгъва списък от имена на групи до плосък списък от думи (непознати имена се пропускат)."""
    out = []
    for n in (names or []):
        out.extend(TOPICS.get(str(n).lower().lstrip("@"), []))
    return out


# ── Релевантност / тематична конкретика ──
_SENT_SPLIT = re.compile(r"[.!?\n•;]+")


def _has(lc, term):
    return term.lower() in lc


def relevance(text, must_all=None, any_of=None, exclude=None, focus=None, context=None):
    """Връща {ok, score, snippet}. Правила:
       • ВСИЧКИ must_all трябва да ги има; никоя exclude да я няма (страница-ниво).
       • any_of: поне една (ако е зададено).
       • focus+context: трябва ИЗРЕЧЕНИЕ, в което focus-дума съжителства с context-дума
         и без exclude-дума → това е доказателството (snippet)."""
    lc = (text or "").lower()
    must_all = must_all or []
    exclude = exclude or []
    focus = focus or []
    context = context or []

    for term in must_all:
        if not _has(lc, term):
            return {"ok": False, "score": 0, "snippet": "", "reason": f"липсва: {term}"}
    for term in exclude:
        if _has(lc, term):
            return {"ok": False, "score": 0, "snippet": "", "reason": f"забранена: {term}"}
    if any_of and not any(_has(lc, x) for x in any_of):
        return {"ok": False, "score": 0, "snippet": "", "reason": "нито една от any_of"}

    score = len(must_all)
    snippet = ""
    if focus or context:
        best = None
        for raw in _SENT_SPLIT.split(text or ""):
            s = raw.strip()
            if not s:
                continue
            sl = s.lower()
            if exclude and any(_has(sl, e) for e in exclude):
                continue
            hasf = (not focus) or any(_has(sl, f) for f in focus)
            hasc = (not context) or any(_has(sl, c) for c in context)
            if hasf and hasc:
                sc = sum(_has(sl, c) for c in context) + sum(_has(sl, f) for f in focus)
                if best is None or sc > best[0]:
                    best = (sc, s)
        if focus and context and best is None:
            return {"ok": False, "score": 0, "snippet": "", "reason": "focus и context не са в едно изречение"}
        if best:
            score += 2 + best[0]
            snippet = best[1][:300]

    return {"ok": True, "score": score, "snippet": snippet}
