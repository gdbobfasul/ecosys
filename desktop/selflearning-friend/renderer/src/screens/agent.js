// agent.js (screen) — екран „🛠 Агент" (САМО на десктоп клонинга).
//
// Дава достъп до десктоп суперсилите през моста SLF_AGENT (preload → IPC → main):
//   1) Файлова система — избор на базова папка, листване, четене, писане.
//   2) Изпълнение на команди — shell run със stdout/stderr/код.
//   3) SSH — запазени хостове (ключ/парола локално), изпълнение на команда.
//   4) Уеб ровене (Playwright) — отвори URL, извлечи заглавие/текст/линкове.
//
// ВСЯКО мощно действие минава през confirmDangerous(): отключена сесия + ВЯРНА кодова
// дума + изричен „⚠ ОПАСНА команда" модал, който показва ТОЧНО какво ще се изпълни.
// След резултат има бутон „Запомни резултата" → addMemory (ботът се учи от изхода).

import { el, clear, toast } from '../ui/dom.js';
import { confirmDangerous } from '../ui/confirm-gate.js';
import { addMemory } from '../core/memory-store.js';

const A = () => (typeof window !== 'undefined' ? window.SLF_AGENT : null);

export function renderAgent(root) {
  clear(root);

  root.appendChild(el('h2', {}, '🛠 Агент'));

  if (!A()) {
    root.appendChild(el('p', { class: 'muted' },
      'Агентските суперсили са налични само в десктоп приложението (Electron). ' +
      'Тук липсва мостът SLF_AGENT.'));
    return;
  }

  // Честно предупреждение за риска.
  root.appendChild(el('div', { class: 'card', style: 'border:1px solid var(--err)' }, [
    el('div', { style: 'font-weight:700;color:var(--err)' }, '⚠ Реални мощи — внимавай'),
    el('div', { class: 'muted', style: 'font-size:13px;margin-top:6px' },
      'Тези функции могат да четат/пишат/трият файлове, да пускат команди на този компютър ' +
      'и на отдалечени машини през SSH, и да карат уеб-страници. Единствената защита е ' +
      'кодовата дума + потвърждението. Креденшълите се пазят САМО локално на този компютър. ' +
      'Нищо от това не съществува в телефонните приложения.')
  ]));

  root.appendChild(sectionFs());
  root.appendChild(sectionShell());
  root.appendChild(sectionSsh());
  root.appendChild(sectionWeb());
}

// Помощник: показва изход + бутон „Запомни резултата".
function outputCard() {
  const pre = el('div', { class: 'mem-item', style: 'white-space:pre-wrap;font-family:monospace;font-size:12px;display:none;max-height:280px;overflow:auto' });
  const rememberBtn = el('button', { class: 'secondary', style: 'display:none;margin-top:8px' }, 'Запомни резултата');
  let lastKey = '', lastVal = '';
  function show(key, text) {
    lastKey = key; lastVal = text;
    pre.style.display = 'block';
    pre.textContent = text;
    rememberBtn.style.display = 'inline-block';
  }
  rememberBtn.addEventListener('click', () => {
    addMemory({ type: 'fact', key: lastKey, value: (lastKey + '\n' + lastVal).slice(0, 4000) });
    toast('Запомнено в паметта.');
  });
  return { pre, rememberBtn, show };
}

// --- 1) Файлова система ---------------------------------------------------------
function sectionFs() {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h3', {}, '1) Файлова система'));
  const baseLine = el('div', { class: 'muted', style: 'font-size:13px' }, 'Базова папка: (зареждам…)');
  wrap.appendChild(baseLine);

  async function refreshBase() {
    const r = await A().fs.getBaseDir();
    baseLine.textContent = 'Базова папка: ' + (r && r.baseDir ? r.baseDir : '(няма — избери папка)');
  }
  refreshBase();

  const out = outputCard();
  const relInput = el('input', { type: 'text', placeholder: 'относителен път, напр. notes.txt или подпапка', value: '.' });
  const contentInput = el('textarea', { placeholder: 'съдържание за запис (при „Запиши файл")' });

  wrap.appendChild(el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [
    el('button', { class: 'secondary', onclick: async () => {
      const r = await A().fs.pickBaseDir();
      if (r && r.ok) { toast('Папката е разрешена.'); refreshBase(); }
    } }, 'Избери папка'),
    el('button', { class: 'ghost', onclick: async () => {
      await A().fs.clearBaseDir(); toast('Достъпът е премахнат.'); refreshBase();
    } }, 'Премахни достъпа')
  ]));

  wrap.appendChild(el('label', {}, 'Път (в рамките на папката)'));
  wrap.appendChild(relInput);

  wrap.appendChild(el('div', { class: 'row wrap', style: 'gap:8px;margin-top:8px' }, [
    el('button', { onclick: async () => {
      const r = await A().fs.list(relInput.value || '.');
      if (!r.ok) { out.show('Грешка', r.reason); return; }
      out.show('Листинг: ' + r.path,
        r.items.map((i) => (i.dir ? '📁 ' : '📄 ') + i.name).join('\n') || '(празно)');
    } }, 'Листвай'),
    el('button', { onclick: async () => {
      const r = await A().fs.read(relInput.value);
      if (!r.ok) { out.show('Грешка', r.reason); return; }
      out.show('Файл: ' + r.path, r.content);
    } }, 'Прочети файл'),
    el('button', { class: 'danger', onclick: async () => {
      const rel = relInput.value;
      const ok = await confirmDangerous({
        title: 'Запис на файл (презаписва съществуващ!)',
        danger: 'fs.write → ' + rel + '\n\n--- съдържание ---\n' + (contentInput.value || '(празно)')
      });
      if (!ok) return;
      const r = await A().fs.write(rel, contentInput.value);
      if (!r.ok) { out.show('Грешка', r.reason); return; }
      out.show('Записан файл: ' + r.path, 'Записани ' + r.size + ' байта.');
    } }, 'Запиши файл (опасно)')
  ]));

  wrap.appendChild(el('label', {}, 'Съдържание за запис'));
  wrap.appendChild(contentInput);
  wrap.appendChild(out.pre);
  wrap.appendChild(out.rememberBtn);
  return wrap;
}

// --- 2) Изпълнение на команди ---------------------------------------------------
function sectionShell() {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h3', {}, '2) Изпълнение на команди (shell)'));
  const out = outputCard();
  const cmdInput = el('input', { type: 'text', placeholder: 'напр. node -v   или   curl https://example.com' });

  wrap.appendChild(el('label', {}, 'Команда'));
  wrap.appendChild(cmdInput);
  wrap.appendChild(el('button', { class: 'danger block', style: 'margin-top:8px', onclick: async () => {
    const cmd = cmdInput.value.trim();
    if (!cmd) { toast('Напиши команда.'); return; }
    const ok = await confirmDangerous({
      title: 'Изпълнение на shell команда',
      danger: 'shell.run →\n' + cmd
    });
    if (!ok) return;
    out.show('Команда', 'Изпълнявам…');
    const r = await A().shell.run(cmd, { timeoutMs: 60000 });
    const body =
      'код: ' + (r.code == null ? '(няма)' : r.code) + (r.timedOut ? ' (timeout)' : '') + '\n' +
      (r.reason ? 'грешка: ' + r.reason + '\n' : '') +
      '\n--- stdout ---\n' + (r.stdout || '') +
      '\n--- stderr ---\n' + (r.stderr || '');
    out.show('$ ' + cmd, body);
  } }, 'Изпълни (опасно)'));
  wrap.appendChild(out.pre);
  wrap.appendChild(out.rememberBtn);
  return wrap;
}

// --- 3) SSH ---------------------------------------------------------------------
function sectionSsh() {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h3', {}, '3) SSH към машина (Linux/Windows)'));
  const out = outputCard();

  const label = el('input', { type: 'text', placeholder: 'етикет (напр. „мой VPS")' });
  const host = el('input', { type: 'text', placeholder: 'хост / IP' });
  const port = el('input', { type: 'number', placeholder: '22', value: '22' });
  const user = el('input', { type: 'text', placeholder: 'потребител' });
  const pass = el('input', { type: 'text', placeholder: 'парола (или остави празно за ключ)' });
  const keyPath = el('input', { type: 'text', placeholder: 'път до частен ключ (по избор)' });
  const passphrase = el('input', { type: 'text', placeholder: 'passphrase на ключа (по избор)' });

  const hostsWrap = el('div', { style: 'margin-top:8px' });
  let selectedId = '';

  async function refreshHosts() {
    clear(hostsWrap);
    const r = await A().ssh.listHosts();
    const hosts = (r && r.hosts) || [];
    if (!hosts.length) { hostsWrap.appendChild(el('div', { class: 'muted', style: 'font-size:13px' }, 'Няма запазени хостове.')); return; }
    for (const h of hosts) {
      const row = el('div', { class: 'mem-item' }, [
        el('div', { class: 'k' }, h.label + '  (' + h.auth + ')'),
        el('div', { class: 'v' }, h.username + '@' + h.host + ':' + h.port),
        el('div', { class: 'row', style: 'gap:8px;margin-top:8px' }, [
          el('button', { class: 'secondary', style: 'flex:1', onclick: () => { selectedId = h.id; toast('Избран: ' + h.label); } }, 'Избери'),
          el('button', { class: 'danger', onclick: async () => { await A().ssh.deleteHost(h.id); refreshHosts(); } }, 'Изтрий')
        ])
      ]);
      hostsWrap.appendChild(row);
    }
  }
  refreshHosts();

  for (const [lbl, inp] of [['Етикет', label], ['Хост', host], ['Порт', port], ['Потребител', user],
    ['Парола', pass], ['Път до ключ', keyPath], ['Passphrase', passphrase]]) {
    wrap.appendChild(el('label', {}, lbl));
    wrap.appendChild(inp);
  }
  wrap.appendChild(el('button', { class: 'secondary block', style: 'margin-top:8px', onclick: async () => {
    const r = await A().ssh.saveHost({
      label: label.value, host: host.value, port: port.value, username: user.value,
      password: pass.value, privateKeyPath: keyPath.value, passphrase: passphrase.value
    });
    if (!r.ok) { toast('Грешка: ' + r.reason); return; }
    toast('Хостът е запазен локално.'); pass.value = ''; passphrase.value = ''; refreshHosts();
  } }, 'Запази хост (локално)'));

  wrap.appendChild(el('h4', { style: 'margin-top:12px' }, 'Запазени хостове'));
  wrap.appendChild(hostsWrap);

  const sshCmd = el('input', { type: 'text', placeholder: 'команда за избрания хост, напр. uname -a' });
  wrap.appendChild(el('label', {}, 'Команда за избрания хост'));
  wrap.appendChild(sshCmd);
  wrap.appendChild(el('button', { class: 'danger block', style: 'margin-top:8px', onclick: async () => {
    if (!selectedId) { toast('Първо избери хост.'); return; }
    const cmd = sshCmd.value.trim();
    if (!cmd) { toast('Напиши команда.'); return; }
    const ok = await confirmDangerous({
      title: 'SSH изпълнение на ОТДАЛЕЧЕНА машина',
      danger: 'ssh.run (хост ' + selectedId + ') →\n' + cmd
    });
    if (!ok) return;
    out.show('SSH', 'Свързвам се и изпълнявам…');
    const r = await A().ssh.run(selectedId, cmd);
    const body =
      'код: ' + (r.code == null ? '(няма)' : r.code) + '\n' +
      (r.reason ? 'грешка: ' + r.reason + '\n' : '') +
      '\n--- stdout ---\n' + (r.stdout || '') +
      '\n--- stderr ---\n' + (r.stderr || '');
    out.show('ssh $ ' + cmd, body);
  } }, 'Изпълни през SSH (опасно)'));
  wrap.appendChild(out.pre);
  wrap.appendChild(out.rememberBtn);
  return wrap;
}

// --- 4) Уеб ровене (Playwright) -------------------------------------------------
function sectionWeb() {
  const wrap = el('div', { class: 'card' });
  wrap.appendChild(el('h3', {}, '4) Уеб ровене (Playwright)'));
  const out = outputCard();
  const urlInput = el('input', { type: 'text', placeholder: 'https://example.com' });

  wrap.appendChild(el('label', {}, 'URL за отваряне (headless)'));
  wrap.appendChild(urlInput);
  wrap.appendChild(el('button', { class: 'danger block', style: 'margin-top:8px', onclick: async () => {
    const url = urlInput.value.trim();
    if (!url) { toast('Напиши URL.'); return; }
    const ok = await confirmDangerous({
      title: 'Отваряне на уеб-страница (Playwright)',
      danger: 'web.crawl →\n' + url + '\n\nЩе отвори страницата headless и ще извлече текст/линкове.'
    });
    if (!ok) return;
    out.show('Уеб', 'Отварям страницата…');
    const r = await A().web.crawl(url, {});
    if (!r.ok) { out.show('Грешка', r.reason); return; }
    const linkLines = (r.links || []).slice(0, 40).map((l) => '• ' + (l.text || '(без текст)') + ' → ' + l.href).join('\n');
    out.show('🌐 ' + r.title,
      'URL: ' + r.url + '\n\n--- текст ---\n' + (r.text || '').slice(0, 4000) +
      '\n\n--- линкове (до 40) ---\n' + linkLines);
  } }, 'Отвори и извлечи (опасно)'));
  wrap.appendChild(out.pre);
  wrap.appendChild(out.rememberBtn);
  return wrap;
}
