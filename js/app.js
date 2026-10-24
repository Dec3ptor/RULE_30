// UI, render loop and URL state. Algorithms live in js/algos/ and register themselves with CA.register().
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');
  const els = {
    nav: $('#algoNav'), box: $('#canvasBox'), params: $('#params'), info: $('#info'),
    name: $('#algoName'), tagline: $('#algoTagline'), about: $('#about'), status: $('#status'),
    play: $('#playBtn'), step: $('#stepBtn'), reset: $('#resetBtn'), draw: $('#drawBtn'),
    exportBtn: $('#exportBtn'), share: $('#shareBtn'),
    speed: $('#speed'), speedOut: $('#speedOut'), cell: $('#cell'), cellOut: $('#cellOut'),
    toast: $('#toast'),
  };

  // Each speed level runs `steps` ticks every `interval` ms (0 = every frame).
  const SPEEDS = [
    [500, 1], [250, 1], [125, 1], [66, 1], [33, 1], [0, 1], [0, 2], [0, 4], [0, 8], [0, 16], [0, 64],
  ].map(([interval, steps]) => ({ interval, steps }));
  const DEFAULT_SPEED = 5;
  const FRAME_BUDGET_MS = 12;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const state = { algo: null, params: {}, cell: 3, speed: DEFAULT_SPEED, running: false, drawing: finePointer };
  let sim = null, cols = 0, rows = 0, imageData = null, buf32 = null, theme = null;
  let dirty = true, lastTick = 0, lastStatus = 0, lastWidth = 0;

  // ---- Theme ----------------------------------------------------------------
  function readTheme() {
    const css = getComputedStyle(document.documentElement);
    theme = {
      bg: CA.hex(css.getPropertyValue('--cell-bg').trim() || '#ffffff'),
      fg: CA.hex(css.getPropertyValue('--cell-fg').trim() || '#111111'),
    };
    dirty = true;
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);

  // ---- Params ---------------------------------------------------------------
  const paramDef = (key) => state.algo.params.find((p) => p.key === key);
  const realParams = () => state.algo.params.filter((p) => p.type !== 'preset');

  function defaults(algo) {
    const p = {};
    for (const prm of algo.params) if (prm.type !== 'preset') p[prm.key] = prm.default;
    return p;
  }

  const same = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b);

  function decimals(step) {
    const s = String(step);
    return s.includes('e-') ? parseInt(s.split('e-')[1], 10) : (s.split('.')[1] || '').length;
  }

  // Turn a raw string (from a control or the URL) into a param value, or null if invalid.
  function parseValue(prm, raw) {
    switch (prm.type) {
      case 'text': return prm.parse ? prm.parse(raw) : String(raw);
      case 'checkbox': return raw === true || raw === '1' || raw === 'true';
      case 'select': return prm.options.some((o) => o.value === String(raw)) ? String(raw) : null;
      case 'range': {
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        return Number(CA.clamp(n, prm.min, prm.max).toFixed(decimals(prm.step)));
      }
      default: return null;
    }
  }

  function formatValue(prm, v) {
    if (prm.digits != null) return v.toFixed(prm.digits);
    return v + (prm.unit || '');
  }

  function buildParams() {
    els.params.innerHTML = '';
    for (const prm of state.algo.params) {
      const field = document.createElement('div');
      field.className = 'field';
      field.dataset.key = prm.key;
      const id = `p-${prm.key}`;
      const label = CA.esc(prm.label);

      if (prm.type === 'preset' || prm.type === 'select') {
        const opts = prm.type === 'preset'
          ? '<option value="" disabled>Custom</option>' + prm.options.map((o, i) => `<option value="${i}">${CA.esc(o.label)}</option>`).join('')
          : prm.options.map((o) => `<option value="${CA.esc(o.value)}">${CA.esc(o.label)}</option>`).join('');
        field.innerHTML = `<label for="${id}">${label}</label><select id="${id}">${opts}</select>`;
      } else if (prm.type === 'text') {
        const dice = prm.random ? `<button type="button" class="btn square" data-random title="Random" aria-label="Pick a random value">${ICON.dice}</button>` : '';
        field.innerHTML = `<label for="${id}">${label}</label>
          <div class="input-row"><input id="${id}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"${prm.inputmode ? ` inputmode="${prm.inputmode}"` : ''}>${dice}</div>`;
      } else if (prm.type === 'range') {
        field.innerHTML = `<label for="${id}">${label} <output></output></label>
          <input id="${id}" type="range" min="${prm.min}" max="${prm.max}" step="${prm.step}">`;
      } else if (prm.type === 'checkbox') {
        field.innerHTML = `<label class="check"><input id="${id}" type="checkbox"> ${label}</label>`;
      }
      els.params.appendChild(field);
      wireField(prm, field);
    }
    syncControls();
  }

  function wireField(prm, field) {
    const input = field.querySelector('input, select');
    let timer = 0;

    if (prm.type === 'preset') {
      input.addEventListener('change', () => applyPreset(prm.options[+input.value].values));
    } else if (prm.type === 'select') {
      input.addEventListener('change', () => setParams({ [prm.key]: input.value }));
    } else if (prm.type === 'checkbox') {
      input.addEventListener('change', () => setParams({ [prm.key]: input.checked }));
    } else if (prm.type === 'range') {
      const out = field.querySelector('output');
      input.addEventListener('input', () => {
        const v = parseValue(prm, input.value);
        out.textContent = formatValue(prm, v);
        if (prm.live) setParams({ [prm.key]: v });
      });
      input.addEventListener('change', () => { if (!prm.live) setParams({ [prm.key]: parseValue(prm, input.value) }); });
    } else if (prm.type === 'text') {
      const commit = () => {
        clearTimeout(timer);
        const v = parseValue(prm, input.value);
        field.classList.toggle('invalid', v === null);
        if (v !== null && !same(v, state.params[prm.key])) setParams({ [prm.key]: v });
      };
      input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(commit, 350); });
      input.addEventListener('change', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });
      const dice = field.querySelector('[data-random]');
      if (dice) dice.addEventListener('click', () => setParams({ [prm.key]: prm.random() }));
    }
  }

  // Push state.params into the controls (without touching a field the user is typing in).
  function syncControls() {
    for (const prm of state.algo.params) {
      const field = els.params.querySelector(`[data-key="${prm.key}"]`);
      if (!field) continue;
      const input = field.querySelector('input, select');
      const v = state.params[prm.key];
      if (prm.type === 'preset') {
        const i = prm.options.findIndex((o) => Object.entries(o.values).every(([k, val]) => same(state.params[k], val)));
        input.value = i >= 0 ? String(i) : '';
      } else if (prm.type === 'checkbox') {
        input.checked = !!v;
      } else if (prm.type === 'range') {
        input.value = v;
        field.querySelector('output').textContent = formatValue(prm, v);
      } else if (prm.type === 'text') {
        if (document.activeElement !== input) { input.value = v; field.classList.remove('invalid'); }
      } else {
        input.value = v;
      }
      field.hidden = prm.when ? !prm.when(state.params) : false;
    }
  }

  function applyPreset(values) {
    setParams(values);
    // syncControls skips a focused text field; a preset should still overwrite it.
    for (const key of Object.keys(values)) {
      const field = els.params.querySelector(`[data-key="${key}"]`);
      const input = field && field.querySelector('input[type="text"]');
      if (input) { input.value = state.params[key]; field.classList.remove('invalid'); }
    }
  }

  // Change one or more params. Live params update the running sim; anything else restarts it.
  function setParams(changes) {
    let needsReset = false;
    for (const [key, v] of Object.entries(changes)) {
      state.params[key] = v;
      const prm = paramDef(key);
      if (!(prm && prm.live && sim && sim.setParam)) needsReset = true;
    }
    if (needsReset) reset();
    else for (const [key, v] of Object.entries(changes)) sim.setParam(key, v);
    syncControls();
    renderInfo();
    writeHash();
  }

  // ---- Simulation -------------------------------------------------------------
  function layout() {
    const w = Math.floor(els.box.clientWidth);
    lastWidth = w;
    const algo = state.algo;
    const narrow = w < 640;
    const aspect = narrow ? (algo.group === '2D' ? 1 : 0.62) : algo.aspect;
    const maxH = Math.max(260, Math.round(window.innerHeight * 0.72));
    const h = Math.min(Math.round(w * aspect), maxH);
    const cell = state.cell;
    cols = Math.max(9, Math.floor(w / cell));
    rows = Math.max(9, Math.floor(h / cell));
    if (algo.oddCols && cols % 2 === 0) cols--;
    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = `${cols * cell}px`;
    canvas.style.height = `${rows * cell}px`;
    imageData = ctx.createImageData(cols, rows);
    buf32 = new Uint32Array(imageData.data.buffer);
  }

  function reset() {
    sim = state.algo.create(state.params, { cols, rows });
    if (state.algo.prefill) for (let i = 1; i < rows; i++) sim.step();
    dirty = true;
    updateStatus();
  }

  function draw() {
    sim.render(buf32, theme);
    ctx.putImageData(imageData, 0, 0);
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (state.running && !sim.done) {
      const sp = SPEEDS[state.speed];
      if (now - lastTick >= sp.interval - 2) {
        lastTick = now;
        const n = sp.steps * (state.algo.stepsPerTick || 1);
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          sim.step();
          if (sim.done || performance.now() - t0 > FRAME_BUDGET_MS) break;
        }
        dirty = true;
      }
    }
    if (dirty) { draw(); dirty = false; }
    if (now - lastStatus > 120) { updateStatus(); lastStatus = now; }
  }

  function updateStatus() {
    if (!sim) return;
    const parts = [`${state.algo.genLabel || 'Generation'} ${CA.fmt(sim.generation)}`];
    if (sim.stats) parts.push(sim.stats());
    const text = parts.join(' · ');
    if (els.status.textContent !== text) els.status.textContent = text;
  }

  function setRunning(on) {
    state.running = on;
    els.play.innerHTML = on ? `${ICON.pause}<span>Pause</span>` : `${ICON.play}<span>Play</span>`;
    els.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
    lastTick = 0;
  }

  function setDrawing(on) {
    state.drawing = on;
    els.draw.setAttribute('aria-pressed', String(on));
    canvas.classList.toggle('drawing', on && !!state.algo.paintable);
  }

  // ---- Algorithm selection ----------------------------------------------------------
  function buildNav() {
    const groups = {};
    for (const a of CA.algorithms) (groups[a.group] = groups[a.group] || []).push(a);
    els.nav.innerHTML = Object.entries(groups).map(([g, list]) =>
      `<div class="nav-group"><span class="nav-label">${g}</span>${list
        .map((a) => `<button type="button" class="chip" data-algo="${a.id}">${CA.esc(a.name)}</button>`)
        .join('')}</div>`).join('');
    els.nav.addEventListener('click', (e) => {
      const b = e.target.closest('[data-algo]');
      if (b && b.dataset.algo !== state.algo.id) selectAlgo(b.dataset.algo);
    });
  }

  function selectAlgo(id, fromHash) {
    const algo = CA.algorithms.find((a) => a.id === id) || CA.algorithms[0];
    state.algo = algo;
    state.params = defaults(algo);
    state.cell = algo.defaultCell || 3;
    if (fromHash) applyHashParams(fromHash);

    for (const b of els.nav.querySelectorAll('[data-algo]')) {
      const on = b.dataset.algo === algo.id;
      b.setAttribute('aria-pressed', String(on));
      if (on && b.scrollIntoView && !fromHash) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
    els.name.textContent = algo.name;
    els.tagline.textContent = algo.tagline;
    els.about.innerHTML = `<h2>About: ${CA.esc(algo.name)}</h2>${algo.about}`;
    els.cell.value = state.cell;
    els.cellOut.textContent = `${state.cell} px`;
    els.draw.hidden = !algo.paintable;
    setDrawing(state.drawing);
    updateSpeedLabel();
    buildParams();
    layout();
    reset();
    renderInfo();
    setRunning(!algo.prefill);
    writeHash();
    document.title = `${algo.name} · Cellular Automata`;
  }

  function renderInfo() {
    els.info.innerHTML = state.algo.info ? state.algo.info(state.params) : '';
  }

  // Links inside the info panel can set a param, e.g. the "equivalent rules" list.
  els.info.addEventListener('click', (e) => {
    const b = e.target.closest('[data-param]');
    if (!b) return;
    const prm = paramDef(b.dataset.param);
    const v = prm && parseValue(prm, b.dataset.value);
    if (v !== null && v !== undefined) {
      setParams({ [prm.key]: v });
      const input = els.params.querySelector(`[data-key="${prm.key}"] input`);
      if (input) input.value = v;
    }
  });

  // ---- URL hash: #life?rule=B36/S23&cell=4 ---------------------------------------
  // Debounced: Safari throws if replaceState is called too often (e.g. while dragging a slider).
  let hashTimer = 0;
  function writeHash() {
    clearTimeout(hashTimer);
    hashTimer = setTimeout(writeHashNow, 250);
  }

  function writeHashNow() {
    const q = new URLSearchParams();
    for (const prm of realParams()) {
      const v = state.params[prm.key];
      if (same(v, prm.default)) continue;
      q.set(prm.key, prm.type === 'checkbox' ? (v ? '1' : '0') : String(v));
    }
    if (state.cell !== (state.algo.defaultCell || 3)) q.set('cell', state.cell);
    const qs = q.toString().replace(/%2F/g, '/');
    const hash = `#${state.algo.id}${qs ? '?' + qs : ''}`;
    if (location.hash !== hash) history.replaceState(null, '', hash);
  }

  function readHash() {
    const raw = location.hash.slice(1);
    if (!raw) return null;
    const i = raw.indexOf('?');
    const id = decodeURIComponent(i < 0 ? raw : raw.slice(0, i));
    return { id, q: new URLSearchParams(i < 0 ? '' : raw.slice(i + 1)) };
  }

  function applyHashParams(q) {
    for (const prm of realParams()) {
      if (!q.has(prm.key)) continue;
      const v = parseValue(prm, q.get(prm.key));
      if (v !== null) state.params[prm.key] = v;
    }
    const cell = parseInt(q.get('cell'), 10);
    if (cell >= 1 && cell <= 12) state.cell = cell;
  }

  window.addEventListener('hashchange', () => {
    const h = readHash();
    if (h) selectAlgo(h.id, h.q);
  });

  // ---- Controls -----------------------------------------------------------------
  function updateSpeedLabel() {
    const sp = SPEEDS[state.speed];
    const perSec = (sp.interval ? 1000 / sp.interval : 60) * sp.steps * (state.algo.stepsPerTick || 1);
    els.speedOut.textContent = `${CA.fmt(perSec)}/s`;
  }

  els.play.addEventListener('click', () => setRunning(!state.running));
  els.step.addEventListener('click', () => {
    setRunning(false);
    const n = state.algo.stepsPerTick || 1;
    for (let i = 0; i < n && !sim.done; i++) sim.step();
    dirty = true;
    updateStatus();
  });
  els.reset.addEventListener('click', () => reset());
  els.draw.addEventListener('click', () => setDrawing(!state.drawing));

  els.speed.addEventListener('input', () => {
    state.speed = +els.speed.value;
    updateSpeedLabel();
  });
  els.cell.addEventListener('input', () => {
    els.cellOut.textContent = `${els.cell.value} px`;
  });
  els.cell.addEventListener('change', () => {
    state.cell = +els.cell.value;
    layout();
    reset();
    writeHash();
  });

  els.exportBtn.addEventListener('click', () => {
    // Scale up so the saved image isn't tiny, keeping cells sharp.
    const scale = Math.max(state.cell, Math.min(12, Math.ceil(1600 / cols)));
    const out = document.createElement('canvas');
    out.width = cols * scale;
    out.height = rows * scale;
    const g = out.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(canvas, 0, 0, out.width, out.height);
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${state.algo.id}-${sim.label || 'pattern'}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  });

  els.share.addEventListener('click', async () => {
    writeHashNow();
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Link copied');
    } catch {
      window.prompt('Copy this link:', location.href);
    }
  });

  let toastTimer = 0;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, select, textarea, button, a')) return;
    if (e.key === ' ') { e.preventDefault(); els.play.click(); }
    else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') els.step.click();
    else if (e.key === 'r' || e.key === 'R') els.reset.click();
  });

  // ---- Drawing on the canvas ----------------------------------------------------------
  let painting = false, eraseStroke = false, lastCell = null;

  function cellAt(e) {
    const r = canvas.getBoundingClientRect();
    const x = CA.clamp(Math.floor(((e.clientX - r.left) / r.width) * cols), 0, cols - 1);
    const y = CA.clamp(Math.floor(((e.clientY - r.top) / r.height) * rows), 0, rows - 1);
    return [x, y];
  }

  function paintLine([x0, y0], [x1, y1]) {
    // Bresenham, so fast strokes don't leave gaps.
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      sim.paint(x0, y0, eraseStroke);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!state.drawing || !state.algo.paintable || !sim.paint) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const c = cellAt(e);
    eraseStroke = e.button === 2 || e.shiftKey || (sim.isAlive ? sim.isAlive(c[0], c[1]) : false);
    sim.paint(c[0], c[1], eraseStroke);
    lastCell = c;
    painting = true;
    dirty = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!painting || sim.paintOnce) return;
    const c = cellAt(e);
    if (c[0] === lastCell[0] && c[1] === lastCell[1]) return;
    paintLine(lastCell, c);
    lastCell = c;
    dirty = true;
  });
  const endPaint = () => { painting = false; };
  canvas.addEventListener('pointerup', endPaint);
  canvas.addEventListener('pointercancel', endPaint);
  canvas.addEventListener('contextmenu', (e) => { if (state.drawing && state.algo.paintable) e.preventDefault(); });

  // Rebuild the grid when the available width changes (ignore height-only changes,
  // which happen constantly on phones as the address bar shows and hides).
  let resizeTimer = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.algo && Math.floor(els.box.clientWidth) !== lastWidth) { layout(); reset(); }
    }, 150);
  }).observe(els.box);

  // ---- Icons ------------------------------------------------------------------------
  const svg = (body, fill) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;
  const ICON = {
    play: svg('<path d="M7 4.5v15l12.5-7.5z"/>', true),
    pause: svg('<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z"/>', true),
    step: svg('<path d="M5 4.5v15l10-7.5zM16 4.5h3v15h-3z"/>', true),
    reset: svg('<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 3.5v5h5"/>'),
    draw: svg('<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3.5 3.5"/>'),
    save: svg('<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 20h14"/>'),
    link: svg('<path d="M10 14a4 4 0 0 0 5.7 0l3.3-3.3a4 4 0 0 0-5.7-5.7l-1.1 1.1"/><path d="M14 10a4 4 0 0 0-5.7 0L5 13.3a4 4 0 0 0 5.7 5.7l1.1-1.1"/>'),
    dice: svg('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>'),
  };

  // ---- Start ----------------------------------------------------------------------------
  els.step.innerHTML = `${ICON.step}<span>Step</span>`;
  els.reset.innerHTML = `${ICON.reset}<span>Reset</span>`;
  els.draw.innerHTML = `${ICON.draw}<span>Draw</span>`;
  els.exportBtn.innerHTML = `${ICON.save}<span>PNG</span>`;
  els.share.innerHTML = `${ICON.link}<span>Link</span>`;
  els.speed.max = SPEEDS.length - 1;
  els.speed.value = state.speed;

  readTheme();
  buildNav();
  const h = readHash();
  selectAlgo(h ? h.id : CA.algorithms[0].id, h ? h.q : null);
  requestAnimationFrame(tick);
})();
