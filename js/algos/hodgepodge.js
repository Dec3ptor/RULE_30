(function () {
  'use strict';

  const STOPS = ['#0a0f24', '#2a1b5c', '#7a2a78', '#d2483e', '#f29a2e', '#ffe7a3'];

  const PRESETS = [
    ['Spiral waves', 200, 3, 3, 50],
    ['Fine spirals', 200, 3, 3, 28],
    ['Big spirals', 150, 3, 3, 20],
    ['Giant spirals', 60, 3, 3, 10],
    ['Ripples', 200, 2, 2, 45],
    ['Glowing blobs', 200, 1, 1, 28],
  ];

  CA.register({
    id: 'hodgepodge',
    name: 'Hodgepodge (BZ reaction)',
    group: 'Nature',
    tagline: 'A model of the Belousov–Zhabotinsky reaction: chemical spirals that never settle.',
    aspect: 0.75,
    defaultCell: 3,
    params: [
      {
        key: 'preset', label: 'Preset', type: 'preset',
        options: PRESETS.map(([label, n, k1, k2, g]) => ({ label, values: { n, k1, k2, g } })),
      },
      { key: 'n', label: 'Number of states', type: 'range', min: 20, max: 255, step: 1, default: 200 },
      { key: 'k1', label: 'Infection from infected neighbours (k1)', type: 'range', min: 1, max: 8, step: 1, default: 3, live: true },
      { key: 'k2', label: 'Infection from ill neighbours (k2)', type: 'range', min: 1, max: 8, step: 1, default: 3, live: true },
      { key: 'g', label: 'Infection speed (g)', type: 'range', min: 1, max: 100, step: 1, default: 50, live: true },
    ],

    create(p, { cols, rows }) {
      const n = p.n;
      let k1 = p.k1, k2 = p.k2, g = p.g;
      let grid = new Uint8Array(cols * rows), next = new Uint8Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = CA.randInt(n + 1);
      const xl = new Int32Array(cols), xr = new Int32Array(cols);
      for (let x = 0; x < cols; x++) { xl[x] = (x - 1 + cols) % cols; xr[x] = (x + 1) % cols; }
      const lut = CA.gradient(STOPS, n + 1);

      return {
        generation: 0,
        step() {
          for (let y = 0; y < rows; y++) {
            const up = ((y - 1 + rows) % rows) * cols, row = y * cols, dn = ((y + 1) % rows) * cols;
            for (let x = 0; x < cols; x++) {
              const c = grid[row + x];
              if (c === n) { next[row + x] = 0; continue; }
              const l = xl[x], r = xr[x];
              let infected = 0, ill = 0, sum = c, v;
              // Eight neighbours, unrolled (this loop runs for every cell, every step).
              v = grid[up + l]; sum += v; if (v === n) ill++; else if (v) infected++;
              v = grid[up + x]; sum += v; if (v === n) ill++; else if (v) infected++;
              v = grid[up + r]; sum += v; if (v === n) ill++; else if (v) infected++;
              v = grid[row + l]; sum += v; if (v === n) ill++; else if (v) infected++;
              v = grid[row + r]; sum += v; if (v === n) ill++; else if (v) infected++;
              v = grid[dn + l]; sum += v; if (v === n) ill++; else if (v) infected++;
              v = grid[dn + x]; sum += v; if (v === n) ill++; else if (v) infected++;
              v = grid[dn + r]; sum += v; if (v === n) ill++; else if (v) infected++;
              if (c === 0) v = Math.floor(infected / k1) + Math.floor(ill / k2);
              else v = Math.floor(sum / (infected + ill + 1)) + g;
              next[row + x] = v > n ? n : v;
            }
          }
          [grid, next] = [next, grid];
          this.generation++;
        },
        render(out) {
          for (let i = 0; i < grid.length; i++) out[i] = lut[grid[i]];
        },
        setParam(key, v) {
          if (key === 'k1') k1 = v;
          if (key === 'k2') k2 = v;
          if (key === 'g') g = v;
        },
        stats() {
          let ill = 0;
          for (let i = 0; i < grid.length; i++) ill += grid[i] === n;
          return `Ill cells ${CA.pct(ill / grid.length)}`;
        },
        label: `hodgepodge-n${n}-g${g}`,
      };
    },

    info(p) {
      return `<div class="speed-bar" style="background:linear-gradient(to right, ${STOPS.join(', ')})"></div>
        <div class="speed-labels small muted"><span>Healthy (0)</span><span>Ill (${p.n})</span></div>
        <p class="small">Healthy cells catch the infection from their neighbours, infected cells get steadily worse, and ill cells recover straight away. The cycle repeats forever as spiral waves.</p>
        <p class="small muted">k1, k2 and g change live, without a restart.</p>`;
    },

    about: `
      <p>The Belousov–Zhabotinsky (BZ) reaction is a chemical mixture that oscillates between colours on its own. Spread thin in a dish, it forms spiral waves that keep turning for minutes.</p>
      <p>The "hodgepodge machine" (Martin Gerhardt and Heike Schuster, 1989) models it with cells that are healthy (0), infected (1 to <em>n</em>−1) or ill (<em>n</em>). A healthy cell becomes infected depending on how many infected and ill neighbours it has (k1 and k2). An infected cell takes the average infection of its neighbourhood and adds g. An ill cell becomes healthy again.</p>
      <p>A. K. Dewdney made it famous in his <em>Scientific American</em> column in 1988, and it is still one of the prettiest simple models of an excitable medium.</p>`,
  });
})();
