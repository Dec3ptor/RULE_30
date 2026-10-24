(function () {
  'use strict';

  const TREE = CA.hex('#2f8f46');
  const FIRE = CA.hex('#ff7b1c');
  const EMBER = CA.hex('#b8321a');

  CA.register({
    id: 'forest',
    name: 'Forest fire',
    group: 'Nature',
    tagline: 'Trees grow, lightning strikes, and fire spreads to neighbouring trees.',
    aspect: 0.75,
    defaultCell: 3,
    params: [
      { key: 'grow', label: 'Tree growth chance per step', type: 'range', min: 0.001, max: 0.1, step: 0.001, default: 0.02, live: true, digits: 3 },
      { key: 'lightning', label: 'Lightning chance per tree', type: 'range', min: 0, max: 0.0005, step: 0.000005, default: 0.00002, live: true, digits: 6 },
      {
        key: 'hood', label: 'Fire spreads to', type: 'select', default: '4',
        options: [{ value: '4', label: '4 neighbours (N, E, S, W)' }, { value: '8', label: '8 neighbours (incl. diagonals)' }],
      },
      { key: 'density', label: 'Starting tree cover', type: 'range', min: 0, max: 100, step: 1, default: 55, unit: '%' },
    ],

    create(p, { cols, rows }) {
      // 0 = empty, 1 = tree, 2 = burning, 3 = embers (cooling, can't burn)
      let grid = new Uint8Array(cols * rows), next = new Uint8Array(cols * rows);
      const d = p.density / 100;
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < d ? 1 : 0;
      let grow = p.grow, strike = p.lightning;
      const eight = p.hood === '8';
      let trees = 0, fires = 0;

      return {
        generation: 0,
        step() {
          trees = 0; fires = 0;
          for (let y = 0; y < rows; y++) {
            const up = ((y - 1 + rows) % rows) * cols, row = y * cols, dn = ((y + 1) % rows) * cols;
            for (let x = 0; x < cols; x++) {
              const i = row + x;
              const c = grid[i];
              let v;
              if (c === 2) v = 3;
              else if (c === 3) v = 0;
              else if (c === 0) v = Math.random() < grow ? 1 : 0;
              else {
                const l = x === 0 ? cols - 1 : x - 1, r = x === cols - 1 ? 0 : x + 1;
                const burning =
                  grid[up + x] === 2 || grid[dn + x] === 2 || grid[row + l] === 2 || grid[row + r] === 2 ||
                  (eight && (grid[up + l] === 2 || grid[up + r] === 2 || grid[dn + l] === 2 || grid[dn + r] === 2));
                v = burning || Math.random() < strike ? 2 : 1;
              }
              next[i] = v;
              if (v === 1) trees++;
              else if (v === 2) fires++;
            }
          }
          [grid, next] = [next, grid];
          this.generation++;
        },
        render(out, theme) {
          const pal = [theme.bg, TREE, FIRE, EMBER];
          for (let i = 0; i < grid.length; i++) out[i] = pal[grid[i]];
        },
        setParam(key, v) {
          if (key === 'grow') grow = v;
          if (key === 'lightning') strike = v;
        },
        paint(x, y) { if (grid[y * cols + x] === 1) grid[y * cols + x] = 2; },
        stats() { return `Trees ${CA.pct(trees / grid.length)} · Burning ${CA.fmt(fires)}`; },
        label: 'forest-fire',
      };
    },

    info() {
      return `<ul class="legend">
          <li><span class="swatch" style="background:#2f8f46"></span>Tree</li>
          <li><span class="swatch" style="background:#ff7b1c"></span>Burning</li>
          <li><span class="swatch" style="background:#b8321a"></span>Embers</li>
          <li><span class="swatch" style="background:var(--cell-bg)"></span>Empty ground</li>
        </ul>
        <p class="small muted">The sliders take effect without restarting. Turn on Draw and tap a tree to set it alight.</p>`;
    },

    about: `
      <p>The Drossel–Schwabl forest-fire model (1992) has three rules: a burning tree burns out and leaves empty ground; a tree catches fire if a neighbour is burning (or, very rarely, if lightning strikes it); and a new tree grows on empty ground with a small probability.</p>
      <p>Here a burnt tree spends one extra step as embers before the ground is empty, which makes the fire fronts easier to see.</p>
      <p>When trees grow much faster than lightning strikes, the forest builds up until a single strike can burn a huge area. Fires of every size appear, following a power law, another example of self-organised criticality.</p>`,
  });
})();
