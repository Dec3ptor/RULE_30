(function () {
  'use strict';

  // Gray-Scott model, using Karl Sims' discretisation (dA = 1, dB = 0.5, dt = 1).
  const PRESETS = [
    ['Coral growth', 0.0545, 0.062],
    ['Mitosis', 0.0367, 0.0649],
    ['Fingerprints', 0.037, 0.06],
    ['Spots and worms', 0.034, 0.0618],
    ['Worms', 0.078, 0.061],
    ['Spots', 0.035, 0.065],
    ['Holes', 0.039, 0.058],
    ['Wandering spots', 0.014, 0.054],
    ['Turbulent rings', 0.018, 0.051],
    ['U-skate world', 0.062, 0.0609],
  ];

  const LUT = CA.gradient(['#08121f', '#123a5a', '#1b7a8c', '#4fc3a1', '#f4f1bb'], 256);

  CA.register({
    id: 'reaction',
    name: 'Reaction–diffusion',
    group: 'Nature',
    tagline: 'Two virtual chemicals diffuse and react, growing coral, spots and stripes.',
    aspect: 0.75,
    defaultCell: 3,
    stepsPerTick: 8,
    paintable: true,
    params: [
      {
        key: 'preset', label: 'Pattern', type: 'preset',
        options: PRESETS.map(([label, feed, kill]) => ({ label, values: { feed, kill } })),
      },
      { key: 'feed', label: 'Feed rate (F)', type: 'range', min: 0.01, max: 0.1, step: 0.0001, default: 0.0545, live: true, digits: 4 },
      { key: 'kill', label: 'Kill rate (k)', type: 'range', min: 0.04, max: 0.075, step: 0.0001, default: 0.062, live: true, digits: 4 },
      {
        key: 'seed', label: 'Start', type: 'select', default: 'blobs',
        options: [
          { value: 'blobs', label: 'Random blobs' },
          { value: 'centre', label: 'One square in the middle' },
          { value: 'noise', label: 'Noise everywhere' },
        ],
      },
    ],

    create(p, { cols, rows }) {
      const N = cols * rows;
      let A = new Float32Array(N).fill(1), B = new Float32Array(N);
      let A2 = new Float32Array(N), B2 = new Float32Array(N);
      let F = p.feed, K = p.kill;

      // Neighbour index tables with wrap-around.
      const xl = new Int32Array(cols), xr = new Int32Array(cols);
      for (let x = 0; x < cols; x++) { xl[x] = (x - 1 + cols) % cols; xr[x] = (x + 1) % cols; }

      const blob = (cx, cy, r) => {
        for (let y = -r; y <= r; y++) {
          for (let x = -r; x <= r; x++) {
            const gx = (cx + x + cols) % cols, gy = (cy + y + rows) % rows;
            const i = gy * cols + gx;
            A[i] = 0.5;
            B[i] = 0.25 + Math.random() * 0.05;
          }
        }
      };

      if (p.seed === 'centre') {
        blob(cols >> 1, rows >> 1, Math.max(3, Math.round(Math.min(cols, rows) * 0.04)));
      } else if (p.seed === 'noise') {
        for (let i = 0; i < N; i++) if (Math.random() < 0.08) { A[i] = 0.5; B[i] = 0.25; }
      } else {
        const count = Math.max(6, Math.round(N / 2500));
        for (let k = 0; k < count; k++) blob(CA.randInt(cols), CA.randInt(rows), 2 + CA.randInt(4));
      }

      return {
        generation: 0,
        step() {
          for (let y = 0; y < rows; y++) {
            const up = ((y - 1 + rows) % rows) * cols, row = y * cols, dn = ((y + 1) % rows) * cols;
            for (let x = 0; x < cols; x++) {
              const l = xl[x], r = xr[x], i = row + x;
              const a = A[i], b = B[i];
              const lapA =
                0.2 * (A[row + l] + A[row + r] + A[up + x] + A[dn + x]) +
                0.05 * (A[up + l] + A[up + r] + A[dn + l] + A[dn + r]) - a;
              const lapB =
                0.2 * (B[row + l] + B[row + r] + B[up + x] + B[dn + x]) +
                0.05 * (B[up + l] + B[up + r] + B[dn + l] + B[dn + r]) - b;
              const abb = a * b * b;
              let na = a + lapA - abb + F * (1 - a);
              let nb = b + 0.5 * lapB + abb - (K + F) * b;
              A2[i] = na < 0 ? 0 : na > 1 ? 1 : na;
              B2[i] = nb < 0 ? 0 : nb > 1 ? 1 : nb;
            }
          }
          [A, A2] = [A2, A];
          [B, B2] = [B2, B];
          this.generation++;
        },
        render(out) {
          for (let i = 0; i < N; i++) {
            const v = B[i] * 3;
            out[i] = LUT[v >= 1 ? 255 : (v * 255) | 0];
          }
        },
        setParam(key, v) {
          if (key === 'feed') F = v;
          if (key === 'kill') K = v;
        },
        paint(x, y) { blob(x, y, 2); },
        stats() {
          let s = 0;
          for (let i = 0; i < N; i++) s += B[i];
          return `Amount of B ${(s / N).toFixed(3)}`;
        },
        label: `gray-scott-f${F}-k${K}`,
      };
    },

    info(p) {
      return `<p class="small">Feed <span class="mono">F = ${p.feed.toFixed(4)}</span> adds chemical A; kill <span class="mono">k = ${p.kill.toFixed(4)}</span> removes chemical B. Small changes to either can switch between completely different patterns. The sliders take effect without restarting.</p>
        <p class="small muted">Turn on Draw and drag to add drops of B.</p>`;
    },

    about: `
      <p>This is the Gray–Scott model of two chemicals, A and B, spread over a surface. Both diffuse (A twice as fast as B). Where they meet, the reaction A + 2B → 3B turns A into B. A is constantly fed in at rate F, and B is removed at rate k.</p>
      <p>Strictly speaking this is a continuous simulation rather than a cellular automaton, but it runs the same way: every cell updates from its neighbours using a fixed local rule.</p>
      <p>Alan Turing proposed in 1952 that reactions like this could explain animal markings such as spots and stripes. John Pearson's 1993 survey mapped the F–k plane and found a zoo of patterns: dividing cells, fingerprints, worms, holes and moving spots.</p>`,
  });
})();
