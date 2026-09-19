// Version: 1.0001
// 🧰 Инструменти — напълно ОФЛАЙН помощни инструменти за обяви/публикации:
//   1) Библиотека с шаблони (готови обяви → редактиране → копиране; localStorage)
//   2) Форматиране и броячи (символи/думи/редове, лимити по платформа, регистри)
//   3) Помощник за хаштагове/емоджи (списък за многократна употреба; localStorage)
// БЕЗ мрежа, БЕЗ AI ключ — работи изцяло на устройството.
// UI надписите са СТАТИЧНИ български текстови възли (runtime i18n ги превежда после);
// JS-ът само окабелява поведение + localStorage. Съобщенията за статус живеят като
// статични data-* атрибути, за да няма български низове, генерирани в JS.
import { copyText } from '../core/ui.js';

const LS_TPL = 'pk_offtk_tpl_draft'; // последно редактиран текст на шаблона
const LS_TAGS = 'pk_offtk_tags';     // запазен списък хаштагове/емоджи

function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

export function render(root) {
  root.innerHTML = `
    <div class="status" id="tkMsg"
         data-copied="Копирано."
         data-saved="Запазено."
         data-added="Добавено към текста."
         data-cleared="Изчистено."
         data-empty="Няма нищо за добавяне."
         data-picked="Шаблонът е зареден — редактирай свободно."></div>

    <div class="tabs" id="tkTabs">
      <button class="tab active" data-tab="tpl">Шаблони</button>
      <button class="tab" data-tab="fmt">Форматиране</button>
      <button class="tab" data-tab="tags">Хаштагове</button>
    </div>

    <!-- ============ 1) ШАБЛОНИ ============ -->
    <section data-panel="tpl">
      <div class="tool-card">
        <label>Готови шаблони за обяви</label>
        <div class="hint">Избери шаблон, редактирай текста и го копирай. Промените се пазят на устройството.</div>
        <div class="row" id="tplPick" style="margin-top:12px">
          <button class="btn inline sec" data-tpl="event">Обява за събитие</button>
          <button class="btn inline sec" data-tpl="sale">Обява за продажба</button>
          <button class="btn inline sec" data-tpl="offer">Търсене / Предлагане</button>
          <button class="btn inline sec" data-tpl="greet">Поздрав</button>
          <button class="btn inline sec" data-tpl="team">Съобщение за екип</button>
          <button class="btn inline sec" data-tpl="rent">Обява за наем</button>
          <button class="btn inline sec" data-tpl="lost">Изгубено / Намерено</button>
        </div>
        <textarea id="tplText" style="margin-top:14px" placeholder="Избери шаблон отгоре или пиши тук…"></textarea>
        <div class="row" style="margin-top:12px">
          <button class="btn inline" data-act="tplCopy">Копирай</button>
          <button class="btn inline sec" data-act="tplClear">Изчисти</button>
        </div>
      </div>

      <!-- Статични тела на шаблоните (скрити) — четат се от JS; runtime i18n ги превежда -->
      <div hidden id="tplStore">
        <div data-body="event">📢 ПОКАНА ЗА СЪБИТИЕ

Заглавие: [име на събитието]
Дата и час: [дд.мм.гггг, чч:мм]
Място: [адрес / локация]

Кратко описание: [какво ще се случи и защо си струва]

Вход: [свободен / с покана / цена]
Повече информация: [телефон / имейл]

Заповядайте! Очакваме ви.</div>

        <div data-body="sale">🏷️ ПРОДАВА СЕ: [артикул]

Състояние: [ново / като ново / употребявано]
Цена: [сума] (по договаряне)
Локация: [град / квартал]

Описание: [ключови характеристики, причина за продажба]

За контакт: [телефон / имейл]
Възможна доставка / оглед на място.</div>

        <div data-body="offer">🔎 ТЪРСЯ / ПРЕДЛАГАМ: [услуга или предмет]

Какво предлагам/търся: [описание]
Условия: [цена / срокове / изисквания]
Регион: [град / район]

За връзка: [телефон / имейл]
Отговарям бързо. Сериозни запитвания.</div>

        <div data-body="greet">🎉 ЧЕСТИТ ПРАЗНИК!

Скъпи [име / приятели / колеги],

Пожелаваме ви [здраве, успех, усмивки и топли мигове]. Нека [празникът] ви донесе радост и вдъхновение!

С най-топли пожелания,
[име / екип]</div>

        <div data-body="team">📌 СЪОБЩЕНИЕ ЗА ЕКИПА

Тема: [кратко заглавие]
До: [екип / отдел]

Съобщение: [какво трябва да се знае / направи]

Краен срок: [дата]
Отговорник: [име]

Благодаря за вниманието!</div>

        <div data-body="rent">🏠 ДАВА СЕ ПОД НАЕМ: [имот]

Тип: [апартамент / стая / офис] — [брой стаи]
Локация: [град / квартал]
Наем: [сума] / месец + [консумативи / депозит]

Обзавеждане: [обзаведен / необзаведен]
Свободен от: [дата]

Оглед и контакт: [телефон / имейл]</div>

        <div data-body="lost">❗ ИЗГУБЕНО / НАМЕРЕНО: [предмет / животно]

Какво: [описание, отличителни белези]
Кога: [дата, приблизителен час]
Къде: [район / улица]

Ако имате информация, моля свържете се: [телефон]
Предлага се награда за информация.</div>
      </div>
    </section>

    <!-- ============ 2) ФОРМАТИРАНЕ И БРОЯЧИ ============ -->
    <section data-panel="fmt" hidden>
      <div class="tool-card">
        <label>Текст за форматиране</label>
        <textarea id="fmtText" placeholder="Постави или напиши текста на обявата тук…"></textarea>
        <div class="cmp" style="margin-top:14px">
          <div><div class="sz" data-c="chars">0</div><div class="hint">символи</div></div>
          <div><div class="sz" data-c="words">0</div><div class="hint">думи</div></div>
          <div><div class="sz" data-c="lines">0</div><div class="hint">редове</div></div>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn inline" data-fmt="upper">ГЛАВНИ</button>
          <button class="btn inline" data-fmt="lower">малки</button>
          <button class="btn inline" data-fmt="title">Първа Главна</button>
          <button class="btn inline sec" data-fmt="spaces">Изчисти интервалите</button>
          <button class="btn inline sec" data-fmt="copy">Копирай</button>
        </div>
      </div>

      <div class="tool-card">
        <label>Лимити по платформа — оставащи символи</label>
        <div class="out-block" id="fmtLimits">
          <div class="line"><span>X / Twitter · 280</span><span data-rem data-max="280">280</span></div>
          <div class="line"><span>SMS · 160</span><span data-rem data-max="160">160</span></div>
          <div class="line"><span>Instagram надпис · 2200</span><span data-rem data-max="2200">2200</span></div>
          <div class="line"><span>Заглавие / SEO · 60</span><span data-rem data-max="60">60</span></div>
        </div>
        <div class="hint">Отрицателно число (в червено) = текстът надхвърля лимита на платформата.</div>
      </div>
    </section>

    <!-- ============ 3) ХАШТАГОВЕ / ЕМОДЖИ ============ -->
    <section data-panel="tags" hidden>
      <div class="tool-card">
        <label>Добави хаштаг или емоджи</label>
        <div class="row">
          <div style="flex:2"><input id="tagInput" type="text" placeholder="#промоция или 🎉" autocomplete="off" /></div>
          <button class="btn inline" data-act="tagAdd" style="flex:1">Добави</button>
        </div>
        <div class="hint" style="margin-top:10px">Бързи предложения:</div>
        <div class="row" id="tagSuggest" style="margin-top:8px">
          <button class="btn inline sec" data-sug="#обява">#обява</button>
          <button class="btn inline sec" data-sug="#продажба">#продажба</button>
          <button class="btn inline sec" data-sug="#събитие">#събитие</button>
          <button class="btn inline sec" data-sug="#новина">#новина</button>
          <button class="btn inline sec" data-sug="#важно">#важно</button>
          <button class="btn inline sec" data-sug="#наем">#наем</button>
          <button class="btn inline sec" data-sug="🎉">🎉</button>
          <button class="btn inline sec" data-sug="📢">📢</button>
          <button class="btn inline sec" data-sug="✅">✅</button>
          <button class="btn inline sec" data-sug="📍">📍</button>
          <button class="btn inline sec" data-sug="🔥">🔥</button>
        </div>
      </div>

      <div class="tool-card">
        <label>Моят списък (запазен на устройството)</label>
        <div id="tagList" class="row" style="margin-top:6px"></div>
        <div class="empty" id="tagEmpty">Списъкът е празен. Добави хаштагове или емоджи отгоре.</div>
        <div class="row" style="margin-top:14px">
          <button class="btn inline" data-act="tagAppend">Добави към текста</button>
          <button class="btn inline sec" data-act="tagCopy">Копирай списъка</button>
          <button class="btn inline sec" data-act="tagClear">Изчисти списъка</button>
        </div>
        <div class="hint" style="margin-top:8px">„Добави към текста" долепя списъка към текста в раздел „Форматиране".</div>
      </div>
    </section>
  `;

  const $ = (s) => root.querySelector(s);
  const $$ = (s) => Array.from(root.querySelectorAll(s));
  const msgEl = $('#tkMsg');

  function toast(name) {
    const text = msgEl.dataset[name] || '';
    msgEl.className = 'status show ok';
    msgEl.textContent = text;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { msgEl.className = 'status'; }, 3000);
  }

  // ---- Превключване на подразделите ----
  $$('#tkTabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('#tkTabs .tab').forEach((b) => b.classList.toggle('active', b === btn));
      const tab = btn.dataset.tab;
      $$('section[data-panel]').forEach((sec) => { sec.hidden = sec.dataset.panel !== tab; });
    });
  });

  // ================= 1) ШАБЛОНИ =================
  const tplText = $('#tplText');
  tplText.value = lsGet(LS_TPL, '');
  tplText.addEventListener('input', () => lsSet(LS_TPL, tplText.value));

  $$('#tplPick [data-tpl]').forEach((b) => {
    b.addEventListener('click', () => {
      const body = $(`#tplStore [data-body="${b.dataset.tpl}"]`);
      if (!body) return;
      tplText.value = body.textContent.trim();
      lsSet(LS_TPL, tplText.value);
      toast('picked');
    });
  });

  // ================= 2) ФОРМАТИРАНЕ =================
  const fmtText = $('#fmtText');

  function recount() {
    const v = fmtText.value;
    const words = (v.trim().match(/\S+/g) || []).length;
    $('[data-c="chars"]').textContent = v.length;
    $('[data-c="words"]').textContent = words;
    $('[data-c="lines"]').textContent = v ? v.split(/\n/).length : 0;
    $$('#fmtLimits [data-rem]').forEach((s) => {
      const max = parseInt(s.dataset.max, 10);
      const rem = max - v.length;
      s.textContent = rem;
      s.style.color = rem < 0 ? 'var(--err)' : '';
      s.style.fontWeight = rem < 0 ? '700' : '';
    });
  }

  async function applyFmt(op) {
    let v = fmtText.value;
    if (op === 'copy') { if (v) { await copyText(v); toast('copied'); } return; }
    if (op === 'upper') v = v.toUpperCase();
    else if (op === 'lower') v = v.toLowerCase();
    else if (op === 'title') v = v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    else if (op === 'spaces') v = v.replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/[ \t]+$/gm, '').trim();
    fmtText.value = v;
    recount();
  }

  fmtText.addEventListener('input', recount);
  $$('[data-fmt]').forEach((b) => b.addEventListener('click', () => applyFmt(b.dataset.fmt)));
  recount();

  // ================= 3) ХАШТАГОВЕ / ЕМОДЖИ =================
  const tagInput = $('#tagInput');
  const tagListEl = $('#tagList');
  const tagEmptyEl = $('#tagEmpty');

  function readTags() {
    try { const a = JSON.parse(lsGet(LS_TAGS, '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function writeTags(arr) { lsSet(LS_TAGS, JSON.stringify(arr)); }

  function drawTags() {
    const arr = readTags();
    tagEmptyEl.style.display = arr.length ? 'none' : 'block';
    tagListEl.innerHTML = '';
    arr.forEach((tag, i) => {
      const chip = document.createElement('button');
      chip.className = 'btn inline sec';
      chip.textContent = tag + '  ✕';        // самата стойност е потребителски вход, не UI надпис
      chip.setAttribute('aria-label', tag);
      chip.addEventListener('click', () => {
        const cur = readTags(); cur.splice(i, 1); writeTags(cur); drawTags();
      });
      tagListEl.appendChild(chip);
    });
  }

  function addTag(raw) {
    const val = (raw || '').trim();
    if (!val) return;
    const arr = readTags();
    if (!arr.includes(val)) { arr.push(val); writeTags(arr); drawTags(); }
    tagInput.value = '';
  }

  $('[data-act="tagAdd"]').addEventListener('click', () => addTag(tagInput.value));
  tagInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput.value); } });
  $$('#tagSuggest [data-sug]').forEach((b) => b.addEventListener('click', () => addTag(b.dataset.sug)));

  $('[data-act="tagAppend"]').addEventListener('click', () => {
    const arr = readTags();
    if (!arr.length) { toast('empty'); return; }
    const str = arr.join(' ');
    fmtText.value = fmtText.value ? (fmtText.value.replace(/\s+$/, '') + '\n\n' + str) : str;
    recount();
    toast('added');
  });
  $('[data-act="tagCopy"]').addEventListener('click', async () => {
    const arr = readTags();
    if (!arr.length) { toast('empty'); return; }
    await copyText(arr.join(' ')); toast('copied');
  });
  $('[data-act="tagClear"]').addEventListener('click', () => { writeTags([]); drawTags(); toast('cleared'); });

  drawTags();

  // ---- Действия за шаблоните (копиране/изчистване) ----
  $('[data-act="tplCopy"]').addEventListener('click', async () => {
    if (tplText.value) { await copyText(tplText.value); toast('copied'); }
  });
  $('[data-act="tplClear"]').addEventListener('click', () => {
    tplText.value = ''; lsSet(LS_TPL, ''); toast('cleared');
  });
}
