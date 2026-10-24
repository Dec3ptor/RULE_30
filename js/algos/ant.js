(function () {
  'use strict';

  const ANT = CA.hex('#e5484d');
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0]; // up, right, down, left

  function parseTurns(v) {
    const s = String(v).trim().toUpperCase();
    return /^[LRNU]{2,16}$/.test(s) ? s : null;
  }

  CA.register({
    id: 'ant',
    name: "Langton's ant",
    group: '2D',
    tagline: 'An ant that turns left or right depending on the colour it stands on.',
    aspect: 0.75,
    defaultCell: 3,
    stepsPerTick: 40,
    genLabel: 'Step',
    paintable: true,
    params: [
      {
        key: 'preset', label: 'Turmite', type: 'preset',
        options: [
          { label: "RL: Langton's ant (builds a highway)", values: { turns: 'RL' } },
          { label: 'RLR: grows chaotically', values: { turns: 'RLR' } },
          { label: 'LLRR: grows symmetrically', values: { turns: 'LLRR' } },
          { label: 'LRRRRRLLR: fills a square', values: { turns: 'LRRRRRLLR' } },
          { label: 'LLRRRLRLRLLR: winding highway', values: { turns: 'LLRRRLRLRLLR' } },
          { label: 'RRLLLRLLLRRR: growing triangle', values: { turns: 'RRLLLRLLLRRR' } },
        ],
      },
      { key: 'turns', label: 'Turns per colour (L, R, N = none, U = U-turn)', type: 'text', default: 'RL', parse: parseTurns },
      { key: 'ants', label: 'Ants', type: 'range', min: 1, max: 12, step: 1, default: 1 },
    ],

    create(p, { cols, rows }) {
      const turns = p.turns;
      const n = turns.length;
      const turn = Array.from(turns, (c) => ({ L: 3, R: 1, N: 0, U: 2 }[c]));
      const grid = new Uint8Array(cols * rows);
      const ants = [];
      for (let i = 0; i < p.ants; i++) {
        if (i === 0) {
          ants.push({ x: cols >> 1, y: rows >> 1, d: 0 });
        } else {
          // Spread extra ants around a ring near the middle.
          const a = (i / p.ants) * Math.PI * 2;
          const r = Math.min(cols, rows) * 0.18;
          ants.push({
            x: Math.round(cols / 2 + Math.cos(a) * r),
            y: Math.round(rows / 2 + Math.sin(a) * r),
            d: CA.randInt(4),
          });
        }
      }

      return {
        generation: 0,
        step() {
          for (const ant of ants) {
            const i = ant.y * cols + ant.x;
            const c = grid[i];
            ant.d = (ant.d + turn[c]) & 3;
            grid[i] = c + 1 === n ? 0 : c + 1;
            ant.x += DX[ant.d];
            ant.y += DY[ant.d];
            if (ant.x < 0) ant.x = cols - 1; else if (ant.x >= cols) ant.x = 0;
            if (ant.y < 0) ant.y = rows - 1; else if (ant.y >= rows) ant.y = 0;
          }
          this.generation++;
        },
        render(out, theme) {
          const pal = n === 2 ? [theme.bg, theme.fg] : [theme.bg, ...CA.rainbow(n - 1, 200)];
          for (let i = 0; i < grid.length; i++) out[i] = pal[grid[i]];
          for (const ant of ants) out[ant.y * cols + ant.x] = ANT;
        },
        paint(x, y, erase) {
          // Drawing drops a new ant (erase clears that cell instead).
          if (erase) grid[y * cols + x] = 0;
          else if (!ants.some((a) => a.x === x && a.y === y)) ants.push({ x, y, d: CA.randInt(4) });
        },
        paintOnce: true,
        stats() { return `Ants ${ants.length}`; },
        label: `turmite-${turns}`,
      };
    },

    info(p) {
      const n = p.turns.length;
      const pal = n === 2 ? ['var(--cell-bg)', 'var(--cell-fg)'] : ['var(--cell-bg)', ...Array.from({ length: n - 1 }, (_, i) => `hsl(${(200 + (360 * i) / (n - 1)) % 360} 72% 56%)`)];
      const word = { L: 'turn left', R: 'turn right', N: 'go straight', U: 'U-turn' };
      let html = '<ul class="legend">';
      for (let i = 0; i < n; i++) html += `<li><span class="swatch" style="background:${pal[i]}"></span>${word[p.turns[i]]}</li>`;
      html += '</ul><p class="small muted">Turn on Draw and tap the canvas to drop more ants.</p>';
      return html;
    },

    about: `
      <p>Langton's ant (Chris Langton, 1986) walks on a grid of white and black squares. On a white square it turns right, on a black square it turns left. Either way it flips the colour of the square and steps forward.</p>
      <p>For about 10,000 steps the ant makes a chaotic mess. Then, every time, it starts building a "highway": a diagonal stripe that repeats every 104 steps and goes on forever. No one has proved it always happens.</p>
      <p>Give the ant more colours and you get <em>turmites</em>. The rule string lists what to do on each colour in turn, so RLR means right on colour 0, left on colour 1 and right on colour 2. Some grow symmetric shapes, some fill squares, and some build their own highways.</p>`,
  });
})();
