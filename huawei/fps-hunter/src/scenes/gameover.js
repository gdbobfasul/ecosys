// Game-over / резултат сцена: показва точки, въвеждаш ИМЕ, записва се и се
// класира; показва ранга и Топ-N. Само {name, points} се пазят.
import { THEME } from '../theme.js';

export function showGameOver(root, leaderboard, result, onMenu, onRetry) {
  const a = THEME.accent;
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;inset:0;z-index:20;background:rgba(7,12,20,0.94);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:${THEME.fontStack};color:#dfe7ee;overflow:auto;`;

  const title = result.win ? 'НИВО ПРЕМИНАТО' : (result.allDone ? 'ВСИЧКИ 100 НИВА!' : 'КРАЙ НА ИГРАТА');

  wrap.innerHTML = `
    <h1 style="margin:0;font-size:30px;letter-spacing:3px;color:${result.win ? THEME.good : THEME.danger}">${title}</h1>
    <p style="margin:8px 0;font-size:18px">Достигнато ниво: <b style="color:${a}">${result.level}</b></p>
    <p style="margin:0 0 16px;font-size:22px">Точки: <b style="color:${THEME.accent2}">${result.score}</b></p>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input id="name-input" maxlength="24" placeholder="Въведи име"
        style="padding:10px;border-radius:8px;border:1px solid #2a3b4d;background:#0e1722;color:#fff;font-size:16px;width:200px"/>
      <button id="save-btn" style="padding:10px 18px;border:none;border-radius:8px;background:${a};color:#04121d;font-weight:700;cursor:pointer">Запис</button>
    </div>
    <div id="rank-line" style="height:22px;font-size:14px;color:#9fb0c0;margin-bottom:8px"></div>

    <div id="board" style="width:min(420px,90vw);margin-bottom:18px"></div>

    <div style="display:flex;gap:12px">
      ${result.win ? `<button id="next-btn" style="padding:12px 26px;border:none;border-radius:10px;background:${THEME.good};color:#04121d;font-weight:800;cursor:pointer">Следващо ниво</button>` : ''}
      <button id="retry-btn" style="padding:12px 26px;border:none;border-radius:10px;background:${a};color:#04121d;font-weight:800;cursor:pointer">Отново</button>
      <button id="menu-btn" style="padding:12px 26px;border:none;border-radius:10px;background:#2a3b4d;color:#fff;font-weight:700;cursor:pointer">Меню</button>
    </div>
  `;
  root.appendChild(wrap);

  const nameInput = wrap.querySelector('#name-input');
  const rankLine = wrap.querySelector('#rank-line');
  const board = wrap.querySelector('#board');
  let saved = false;

  const renderBoard = () => {
    const top = leaderboard.top(10);
    board.innerHTML = top.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:15px;background:rgba(0,0,0,0.25);border-radius:10px;overflow:hidden">
          <tbody>${top.map((r, i) => `<tr><td style="padding:2px 10px;color:${a}">${i + 1}</td>
            <td style="padding:2px 10px">${escapeHtml(r.name)}</td>
            <td style="padding:2px 10px;text-align:right;color:${THEME.accent2}">${r.points}</td></tr>`).join('')}</tbody>
        </table>`
      : `<div style="text-align:center;color:#7a8a9a">Все още няма резултати</div>`;
  };
  renderBoard();

  const doSave = async () => {
    if (saved) return;
    saved = true;
    const rank = await leaderboard.addScore(nameInput.value, result.score);
    rankLine.textContent = `Класиране: #${rank}`;
    renderBoard();
  };

  wrap.querySelector('#save-btn').addEventListener('click', doSave);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });

  wrap.querySelector('#retry-btn').addEventListener('click', () => { wrap.remove(); onRetry(result.level); });
  wrap.querySelector('#menu-btn').addEventListener('click', () => { wrap.remove(); onMenu(); });
  const nextBtn = wrap.querySelector('#next-btn');
  if (nextBtn) nextBtn.addEventListener('click', () => { wrap.remove(); onRetry(Math.min(100, result.level + 1)); });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
