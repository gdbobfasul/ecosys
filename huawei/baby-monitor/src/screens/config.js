// Version: 1.0001
// config.js — конфигурация на наблюдението (камера, чувствителност, събития, звук, relay).
import { el, toast } from '../ui/dom.js';
import { toggle } from '../ui/widgets.js';
import { getState, setSettings } from '../core/storage.js';
import { getPairing, setPairing, generatePairKey, checkPairing } from '../core/pairing.js';
import { t } from '../core/i18n.js';

export function renderConfig(root, ctx) {
  const s = getState().settings;

  root.appendChild(el('h1', {}, t('nav_settings')));

  // --- Сдвояване (2 телефона): детегледачка ↔ наблюдаващ ---
  {
    const p = getPairing();
    const roleSel = el('select', {}, [
      optionEl('solo', t('role_solo'), p.role),
      optionEl('monitor', t('role_monitor'), p.role),
      optionEl('watcher', t('role_watcher'), p.role)
    ]);
    const keyIn = el('input', { type: 'text', value: p.pairKey, placeholder: t('pair_key_ph'), autocapitalize: 'none', autocomplete: 'off' });
    const baseIn = el('input', { type: 'text', value: p.relayBase, placeholder: 'https://selflearning.bot.nu', autocapitalize: 'none', autocomplete: 'off' });
    const pollIn = el('input', { type: 'number', value: String(p.pollSeconds), min: '3' });
    const statusEl = el('span', { class: 'pill' }, '');
    root.appendChild(el('div', { class: 'card' }, [
      el('h2', {}, t('pair_title')),
      el('p', { class: 'muted small' }, t('pair_desc')),
      el('label', {}, t('pair_role')), roleSel,
      el('label', {}, t('pair_key_label')), keyIn,
      el('div', { class: 'row', style: 'gap:6px;margin-top:6px' }, [
        el('button', { class: 'btn sm', onclick: () => { keyIn.value = generatePairKey(); } }, t('pair_gen_key'))
      ]),
      el('label', {}, t('pair_relay_label')), baseIn,
      el('label', {}, t('pair_poll_label')), pollIn,
      el('div', { class: 'row', style: 'gap:8px;margin-top:10px;align-items:center' }, [
        el('button', {
          class: 'btn primary', onclick: () => {
            setPairing({ role: roleSel.value, pairKey: keyIn.value.trim(), relayBase: baseIn.value.trim(), pollSeconds: parseInt(pollIn.value, 10) || 6 });
            toast(t('pair_saved'));
            if (ctx && ctx.rerender) ctx.rerender();
          }
        }, t('save')),
        el('button', {
          class: 'btn sm', onclick: async () => {
            setPairing({ role: roleSel.value, pairKey: keyIn.value.trim(), relayBase: baseIn.value.trim() });
            statusEl.textContent = t('pair_checking');
            const r = await checkPairing();
            statusEl.textContent = r.ok ? t('pair_ok') : (t('pair_none') + (r.reason ? ` (${r.reason})` : ''));
          }
        }, t('pair_check')),
        statusEl
      ])
    ]));
  }

  // --- Камера ---
  const camSel = el('select', { onchange: (e) => setSettings({ cameraSource: e.target.value }) }, [
    optionEl('front', t('cam_front'), s.cameraSource),
    optionEl('back', t('cam_back'), s.cameraSource),
    optionEl('other', t('cam_other'), s.cameraSource)
  ]);
  const urlInput = el('input', {
    type: 'url', placeholder: t('cam_url_ph'), value: s.otherCameraUrl,
    oninput: (e) => setSettings({ otherCameraUrl: e.target.value.trim() })
  });
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('camera_title')),
    el('label', {}, t('camera_source')),
    camSel,
    el('label', {}, t('cam_url_label')),
    urlInput,
    el('p', { class: 'muted small' }, t('cam_honest'))
  ]));

  // --- Движение ---
  const sensVal = el('span', { class: 'pill' }, String(s.motionSensitivity));
  const sleepVal = el('span', { class: 'pill' }, s.sleepSeconds + ' ' + t('seconds_short'));
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('motion_title')),
    el('div', { class: 'row between' }, [el('label', {}, t('sensitivity')), sensVal]),
    el('input', {
      type: 'range', min: '0', max: '100', value: String(s.motionSensitivity),
      oninput: (e) => { const v = Number(e.target.value); sensVal.textContent = String(v); setSettings({ motionSensitivity: v }); }
    }),
    el('div', { class: 'row between' }, [el('label', {}, t('calm_after')), sleepVal]),
    el('input', {
      type: 'range', min: '5', max: '120', value: String(s.sleepSeconds),
      oninput: (e) => { const v = Number(e.target.value); sleepVal.textContent = v + ' ' + t('seconds_short'); setSettings({ sleepSeconds: v }); }
    })
  ]));

  // --- Събития ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('alerts_title')),
    toggle(t('alert_wake'), s.alertWake, (v) => setSettings({ alertWake: v })),
    toggle(t('alert_stranger'), s.alertStranger, (v) => setSettings({ alertStranger: v }),
      t('alert_stranger_hint')),
    toggle(t('alert_left'), s.alertLeftFrame, (v) => setSettings({ alertLeftFrame: v })),
    toggle(t('alert_fire'), s.alertFireHeuristic, (v) => setSettings({ alertFireHeuristic: v }),
      t('alert_fire_hint'))
  ]));

  // --- Известия ---
  root.appendChild(el('div', { class: 'card' }, [
    el('h2', {}, t('notify_title')),
    toggle(t('sound'), s.sound, (v) => setSettings({ sound: v })),
    toggle(t('vibrate'), s.vibrate, (v) => setSettings({ vibrate: v })),
    el('label', {}, t('relay_label')),
    el('input', {
      type: 'url', placeholder: 'https://…/notify', value: s.relayUrl,
      oninput: (e) => setSettings({ relayUrl: e.target.value.trim() })
    }),
    el('p', { class: 'muted small' }, t('relay_honest'))
  ]));

  root.appendChild(el('button', { class: 'btn wide', onclick: () => { toast(t('saved')); ctx.navigate('permissions'); } },
    t('to_permissions')));
}

function optionEl(value, label, current) {
  const o = el('option', { value }, label);
  if (value === current) o.setAttribute('selected', '');
  return o;
}
