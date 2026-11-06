// Kept outside #app so a running game's renders do not replace focused controls.
class ColorDuelPreview {
  constructor(role, action) {
    this.root = document.createElement('div');
    this.root.className = 'preview-tools';
    this.root.innerHTML = '<div class="preview-badge">ПРОСМОТР · ДЕМО</div>';
    document.body.append(this.root);
    if (role !== 'control') return;
    const button = (id, label) => `<button data-preview="${id}">${label}</button>`;
    this.root.insertAdjacentHTML('beforeend', `<button class="preview-toggle" title="Показать панель просмотра" aria-label="Показать панель просмотра" hidden>🧪</button>
      <aside class="preview-panel"><header><b>Просмотр интерфейса</b><button data-collapse aria-label="Свернуть панель">−</button></header>
      <small data-preview-status></small><small data-gamepad-status>Геймпад: нет подключения — нажмите кнопку</small><div class="preview-grid">
      ${button('bracelet:111', 'Браслет 111')}${button('bracelet:222', 'Браслет 222')}
      ${button('technician', 'Техник 777')}${button('lobby', 'Лобби / сброс')}${button('rules', 'Правила')}
      ${button('ready', 'Ожидание')}${button('countdown', 'Отсчёт')}
      ${button('game', 'Игра')}${button('gameover', 'GAME OVER')}
      ${button('results', 'Результаты')}${button('leaderboard', 'Лидеры')}
      </div><label>Игровой режим<select data-preview-mode><option value="combination">Цветовая комбинация</option><option value="rhythm">Ритм-дуэль</option><option value="pingPong">Пин-понг</option><option value="colorRing">Цветовое кольцо</option></select></label>
      <button class="preview-run" data-preview="run">Полный запуск раунда</button>
      <div class="preview-hits">${[0, 1].map(p => `<div><span>Игрок ${p + 1} · USB ${p ? '5–8 (4–7)' : '1–4 (0–3)'} · ${p ? 'U I O P' : 'Q W E R'}</span><div>${['red', 'green', 'blue', 'yellow'].map((c, i) => `<button style="--hit:${['#ff334f', '#32e875', '#1b9cff', '#ffd43b'][i]}" data-preview="hit:${p}:${c}" aria-label="Игрок ${p + 1}: ${['красный', 'зелёный', 'синий', 'жёлтый'][i]}"></button>`).join('')}</div></div>`).join('')}</div>
      <small>111 + Enter / 222 + Enter — в любом окне.<br>F12 — инструменты разработчика.</small></aside>`);
    const panel = this.root.querySelector('.preview-panel'), toggle = this.root.querySelector('.preview-toggle');
    const collapse = closed => { panel.hidden = closed; toggle.hidden = !closed; };
    this.root.querySelector('[data-collapse]').onclick = () => collapse(true);
    toggle.onclick = () => collapse(false);
    this.root.addEventListener('click', e => { const id = e.target.closest('[data-preview]')?.dataset.preview; if (id) action(id); });
    this.root.querySelector('select').onchange = e => action(`mode:${e.target.value}`);
  }
  gamepadStatus(status) {
    const label = this.root.querySelector('[data-gamepad-status]');
    if (!label) return;
    label.textContent = status.connected ? `Геймпад: ${status.id} · ${status.buttonCount} кнопок${status.buttonCount < 8 ? ' — нужно минимум 8' : ''}` : 'Геймпад: нет подключения — нажмите кнопку';
  }
  update(state) {
    const status = this.root.querySelector('[data-preview-status]');
    if (status) status.textContent = `${innerWidth} × ${innerHeight} · ${state.phase}`;
    const select = this.root.querySelector('select');
    const mode = state.lobbySelection?.mode || state.mode;
    if (select && select.value !== mode) select.value = mode;
  }
}
