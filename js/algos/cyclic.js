(function () {
  'use strict';

  // Presets from David Griffeath's and Mirek Wójtowicz's catalogues.
  // R = range, T = threshold, C = colours, N = neighbourhood (M = Moore, N = von Neumann).
  const PRESETS = [
    ['Classic demons', 1, 1, 14, 'N'],
    ['313', 1, 3, 3, 'M'],
    ['Cyclic spirals', 3, 5, 8, 'M'],
    ['Squarish spirals', 2, 2, 6, 'N'],
    ['Turbulent phase', 2, 5, 8, 'M'],
    ['Lava lamp', 2, 10, 3, 'M'],
    ['Stripes', 3, 4, 5, 'N'],
    ['Fossil debris', 2, 9, 4, 'M'],
    ['Amoeba', 3, 10, 2, 'N'],
  ];

  CA.register({
    id: 'cyclic',
    name: 'Cyclic',
    group: '2D',
    tagline: 'Colours eat each other in a cycle and organise into spirals.',
    aspect: 0.75,
    defaultCell: 3,
    params: [
      {
        key: 'preset', label: 'Preset', type: 'preset',
        options: PRESETS.map(([label, range, threshold, states, hood]) => ({ label, values: { range, threshold, states, hood } })),
      },
      { key: 'states', label: 'Colours', type: 'range', min: 2, max: 24, step: 1, default: 14 },
      { key: 'threshold', label: 'Threshold', type: 'range', min: 1, max: 30, step: 1, default: 1 },
      { key: 'range', label: 'Range', type: 'range', min: 1, max: 5, step: 1, default: 1 },
      {
        key: 'hood', label: 'Neighbourhood', type: 'select', default: 'N',
        options: [{ value: 'M', label: 'Moore (square)' }, { value: 'N', label: 'von Neumann (diamond)' }],
      },
    ],

    create(p, { cols, rows }) {
      const n = p.states, T = p.threshold, R = p.range;
      const W = cols + 2 * R;
      const padded = new Uint8Array(W * (rows + 2 * R));
      let grid = new Uint8Array(cols * rows), next = new Uint8Array(cols * rows);
      for (let i = 0; i < grid.length; i++) grid[i] = CA.randInt(n);

      const offsets = [];
      for (let dy = -R; dy <= R; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if ((dx || dy) && (p.hood === 'M' || Math.abs(dx) + Math.abs(dy) <= R)) offsets.push(dy * W + dx);
        }
      }
      const offs = Int32Array.from(offsets);
      let changed = 1;

      return {
        generation: 0,
        step() {
          // Copy into a padded buffer with wrapped edges.
          for (let y = -R; y < rows + R; y++) {
            const sy = ((y % rows) + rows) % rows;
            const dst = (y + R) * W;
            for (let x = -R; x < cols + R; x++) {
              const sx = x < 0 ? x + cols : x >= cols ? x - cols : x;
              padded[dst + x + R] = grid[sy * cols + sx];
            }
          }
          let c = 0;
          for (let y = 0; y < rows; y++) {
            const base = (y + R) * W + R, row = y * cols;
            for (let x = 0; x < cols; x++) {
              const i = base + x;
              const s = padded[i];
              const t = s + 1 === n ? 0 : s + 1;
              let k = 0;
              for (let j = 0; j < offs.length; j++) {
                if (padded[i + offs[j]] === t && ++k >= T) break;
              }
              if (k >= T) { next[row + x] = t; c++; } else next[row + x] = s;
            }
          }
          [grid, next] = [next, grid];
          changed = c / grid.length;
          this.generation++;
        },
        render(out) {
          const pal = CA.rainbow(n, 0, 70, 55);
          for (let i = 0; i < grid.length; i++) out[i] = pal[grid[i]];
        },
        stats() { return `Changing ${CA.pct(changed)}`; },
        label: `cyclic-r${R}-t${T}-c${n}-${p.hood}`,
      };
    },

    info(p) {
      const hood = p.hood === 'M' ? 'square (Moore)' : 'diamond (von Neumann)';
      const cells = p.hood === 'M' ? (2 * p.range + 1) ** 2 - 1 : 2 * p.range * (p.range + 1);
      return `<p class="small">Each cell checks the ${cells} cells within range ${p.range} (${hood}). If at least ${p.threshold} of them have the <em>next</em> colour in the cycle, it switches to that colour.</p>
        <p class="small muted">Notation: R${p.range}/T${p.threshold}/C${p.states}/N${p.hood}</p>`;
    },

    about: `
      <p>Every cell has one of <em>n</em> colours arranged in a cycle: 0 → 1 → 2 → … → <em>n</em>−1 → 0. A cell changes to the next colour when enough of its neighbours already have it, as if the next colour "eats" the current one.</p>
      <p>Starting from random noise, the grid passes through stages: first scattered debris, then growing droplets, and finally self-sustaining spiral waves (sometimes called demons) that take over the whole space.</p>
      <p>The rule was studied by David Griffeath and colleagues in the late 1980s and 1990s. Range, threshold and neighbourhood shape change the result a lot: some settings make spirals, some make turbulence, and some freeze.</p>`,
  });
})();
