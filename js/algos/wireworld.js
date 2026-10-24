(function () {
  'use strict';

  // 0 = empty, 1 = electron head, 2 = electron tail, 3 = wire
  const COLORS = { head: CA.hex('#3fa9ff'), tail: CA.hex('#e5484d'), wire: CA.hex('#e0a526') };

  // ---- Circuit building blocks ------------------------------------------------
  function builder(cols, rows) {
    const g = new Uint8Array(cols * rows);
    const set = (x, y, v = 3) => { if (x >= 0 && y >= 0 && x < cols && y < rows) g[y * cols + x] = v; };
    const api = {
      g,
      set,
      hline(x0, x1, y) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) set(x, y); },
      vline(x, y0, y1) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) set(x, y); },
      // A rectangular loop with one electron running clockwise: a clock that
      // sends a pulse every (perimeter) steps. Returns the cell to attach an output to.
      clock(x, y, w, h) {
        api.hline(x, x + w - 1, y);
        api.hline(x, x + w - 1, y + h - 1);
        api.vline(x, y, y + h - 1);
        api.vline(x + w - 1, y, y + h - 1);
        // Start the electron away from the corners, or it splits and runs both ways.
        set(x + 1, y, 2);
        set(x + 2, y, 1);
        return { x: x + w, y: y + (h >> 1) };
      },
      // A diode on a horizontal wire, occupying columns x..x+3 of row y.
      // Forward diodes pass signals travelling right; reversed ones pass signals travelling left.
      diode(x, y, forward = true) {
        api.hline(x - 1, x + 4, y);
        set(forward ? x + 2 : x + 1, y, 0);
        set(x + 1, y - 1); set(x + 2, y - 1);
        set(x + 1, y + 1); set(x + 2, y + 1);
      },
    };
    return api;
  }

  const CIRCUITS = {
    // Clocks of different sizes, some feeding branching wires.
    clocks(cols, rows) {
      const b = builder(cols, rows);
      const n = Math.max(2, Math.min(5, Math.floor((rows - 6) / 11)));
      const gap = Math.floor((rows - 4) / n);
      for (let i = 0; i < n; i++) {
        const y = 3 + i * gap + Math.max(0, (gap - 9) >> 1);
        const w = 4 + i, h = 5 + (i % 3);
        const out = b.clock(3, y, w, h);
        b.hline(out.x, cols - 1, out.y);
        if (i % 2 === 1 && gap >= 9) {
          // Branch: split the signal onto a second wire just below.
          const bx = out.x + 6 + i * 3;
          b.vline(bx, out.y, out.y + 3);
          b.hline(bx, cols - 1, out.y + 3);
        }
      }
      return b.g;
    },

    // One clock feeding two wires: the top one has a forward diode (pulses get through),
    // the bottom one a reversed diode (pulses are blocked).
    diodes(cols, rows) {
      const b = builder(cols, rows);
      const cy = rows >> 1;
      const spread = Math.max(6, Math.min(14, Math.floor(rows / 4)));
      const out = b.clock(3, cy - 3, 6, 7);
      const sx = out.x + 4;
      b.hline(out.x, sx, out.y);
      b.vline(sx, cy - spread, cy + spread);
      b.hline(sx, cols - 1, cy - spread);
      b.hline(sx, cols - 1, cy + spread);
      const dx = Math.max(sx + 6, cols >> 1);
      b.diode(dx, cy - spread, true);
      b.diode(dx, cy + spread, false);
      return b.g;
    },

    // An OR gate: two clocks with different rhythms merge into one output wire.
    or(cols, rows) {
      const b = builder(cols, rows);
      const cy = rows >> 1;
      const spread = Math.max(7, Math.min(14, Math.floor(rows / 4)));
      const top = b.clock(3, cy - spread - 3, 6, 7);
      const bot = b.clock(3, cy + spread - 4, 8, 9);
      const vx = top.x + 4;
      const mx = Math.max(vx + 10, Math.floor(cols * 0.45));
      b.hline(top.x, vx, top.y); b.vline(vx, top.y, cy - 2); b.hline(vx, mx, cy - 2);
      b.hline(bot.x, vx, bot.y); b.vline(vx, bot.y, cy + 2); b.hline(vx, mx, cy + 2);
      // Junction found by exhaustive search: a pulse from either input reaches the
      // other input's last cell from three sides at once, so it can't leak backwards.
      b.set(mx + 1, cy - 1);
      b.set(mx + 1, cy + 1);
      b.hline(mx, cols - 1, cy);
      return b.g;
    },
  };

  CA.register({
    id: 'wireworld',
    name: 'Wireworld',
    group: '2D',
    tagline: 'Electrons flow along wires. Build clocks, diodes and logic gates.',
    aspect: 0.75,
    defaultCell: 7,
    paintable: true,
    params: [
      {
        key: 'start', label: 'Circuit', type: 'select', default: 'diodes',
        options: [
          { value: 'diodes', label: 'Diodes (one passes, one blocks)' },
          { value: 'or', label: 'OR gate' },
          { value: 'clocks', label: 'Clocks and branches' },
          { value: 'empty', label: 'Empty (draw your own)' },
        ],
      },
      {
        key: 'brush', label: 'Draw with', type: 'select', default: 'wire', live: true,
        options: [
          { value: 'wire', label: 'Wire' },
          { value: 'spark', label: 'Electron (tap a wire)' },
          { value: 'erase', label: 'Eraser' },
        ],
      },
    ],

    create(p, { cols, rows }) {
      let grid = p.start === 'empty' ? new Uint8Array(cols * rows) : CIRCUITS[p.start](cols, rows);
      let next = new Uint8Array(cols * rows);
      let brush = p.brush;
      let electrons = 0;

      return {
        generation: 0,
        step() {
          electrons = 0;
          for (let y = 0; y < rows; y++) {
            const row = y * cols;
            for (let x = 0; x < cols; x++) {
              const i = row + x, c = grid[i];
              let v = c;
              if (c === 1) v = 2;
              else if (c === 2) v = 3;
              else if (c === 3) {
                let k = 0;
                for (let dy = -1; dy <= 1; dy++) {
                  const yy = y + dy;
                  if (yy < 0 || yy >= rows) continue;
                  for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx;
                    if ((dx || dy) && xx >= 0 && xx < cols && grid[yy * cols + xx] === 1) k++;
                  }
                }
                if (k === 1 || k === 2) v = 1;
              }
              next[i] = v;
              if (v === 1) electrons++;
            }
          }
          [grid, next] = [next, grid];
          this.generation++;
        },
        render(out, theme) {
          const pal = [theme.bg, COLORS.head, COLORS.tail, COLORS.wire];
          for (let i = 0; i < grid.length; i++) out[i] = pal[grid[i]];
        },
        setParam(key, v) { if (key === 'brush') brush = v; },
        paint(x, y, erase) {
          const i = y * cols + x;
          if (erase || brush === 'erase') grid[i] = 0;
          else if (brush === 'spark') { if (grid[i] === 3) grid[i] = 1; }
          else if (grid[i] === 0) grid[i] = 3;
        },
        stats() { return `Electrons ${CA.fmt(electrons)}`; },
        label: `wireworld-${p.start}`,
      };
    },

    info(p) {
      const tips = {
        diodes: 'One clock feeds two wires. The top wire has a diode facing forward, so pulses pass. The bottom diode faces backward and blocks them.',
        or: 'Two clocks with different rhythms join into one output wire, so a pulse comes out whenever either one fires. The shape of the junction stops pulses leaking back into the other input.',
        clocks: 'Each loop with an electron is a clock that sends out a pulse once per lap. Where a wire splits, the pulse copies itself into both branches.',
        empty: 'Draw wires, then switch "Draw with" to Electron and tap a wire to send pulses along it.',
      };
      return `<ul class="legend">
          <li><span class="swatch" style="background:#e0a526"></span>Wire</li>
          <li><span class="swatch" style="background:#3fa9ff"></span>Electron head</li>
          <li><span class="swatch" style="background:#e5484d"></span>Electron tail</li>
        </ul>
        <p class="small">${tips[p.start]}</p>
        <p class="small muted">Turn on Draw to edit. Use "Draw with" to switch between wire, electrons and eraser.</p>`;
    },

    about: `
      <p>Wireworld (Brian Silverman, 1987) has four states: empty, wire, electron head and electron tail. A head always becomes a tail, a tail always turns back into wire, and a piece of wire becomes a head if exactly one or two of its eight neighbours are heads.</p>
      <p>Those rules are enough to send pulses along wires in one direction (the tail stops them going backwards). With a few clever shapes you get clocks, diodes, and logic gates such as OR, AND and XOR.</p>
      <p>Wireworld is Turing complete: people have built a working computer in it that calculates prime numbers.</p>`,
  });
})();
