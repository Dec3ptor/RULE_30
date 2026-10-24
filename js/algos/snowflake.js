(function () {
  'use strict';

  const SKY = CA.gradient(['#060d1a', '#0f2240'], 64);
  const ICE = CA.gradient(['#4f9fd8', '#a9d8f5', '#ffffff'], 256);

  // Build a hexagonal grid on top of the pixel canvas. Each hex cell is drawn as a
  // 4-pixel-wide brick; odd rows are shifted half a cell and rows alternate 3 and 4
  // pixels tall (3.5 on average, close to a true hexagon's 4 × 0.866).
  function hexGrid(cols, rows) {
    const HC = Math.max(9, Math.floor((cols - 2) / 4));
    const HR = Math.max(9, Math.floor((rows * 2) / 7));
    const N = HC * HR;
    const ox = Math.max(0, (cols - (HC * 4 + 2)) >> 1);
    const oy = Math.max(0, (rows - Math.ceil(HR * 3.5)) >> 1);
    const lut = new Int32Array(cols * rows).fill(-1);
    for (let py = 0; py < rows; py++) {
      const r = Math.floor(((py - oy) * 2) / 7);
      if (py < oy || r >= HR) continue;
      const shift = ox + (r & 1) * 2;
      for (let px = shift; px < cols; px++) {
        const c = (px - shift) >> 2;
        if (c < HC) lut[py * cols + px] = r * HC + c;
      }
    }
    // Six neighbours per cell ("odd-r" offset layout); -1 = off the grid.
    const nb = new Int32Array(N * 6);
    const edge = new Uint8Array(N), nearEdge = new Uint8Array(N);
    const EVEN = [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
    const ODD = [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]];
    for (let r = 0; r < HR; r++) {
      for (let c = 0; c < HC; c++) {
        const i = r * HC + c;
        (r & 1 ? ODD : EVEN).forEach(([dc, dr], k) => {
          const cc = c + dc, rr = r + dr;
          const ok = cc >= 0 && cc < HC && rr >= 0 && rr < HR;
          nb[i * 6 + k] = ok ? rr * HC + cc : -1;
          if (!ok) edge[i] = 1;
        });
        if (c < 3 || r < 3 || c >= HC - 3 || r >= HR - 3) nearEdge[i] = 1;
      }
    }
    const centre = (HR >> 1) * HC + (HC >> 1);
    return { HC, HR, N, lut, nb, edge, nearEdge, centre };
  }

  const PRESETS = [
    ['Stellar dendrite', 0.4, 0.001, 1],
    ['Fern', 0.55, 0.001, 2],
    ['Feathery', 0.5, 0.0001, 1],
    ['Delicate branches', 0.35, 0.0005, 1.6],
    ['Broad star', 0.4, 0.01, 1],
    ['Simple star', 0.8, 0.002, 1],
    ['Hexagonal plate', 0.95, 0.002, 1],
  ];

  CA.register({
    id: 'snowflake',
    name: 'Snowflake',
    group: 'Nature',
    tagline: 'Ice crystals growing from water vapour on a hexagonal grid.',
    aspect: 0.75,
    defaultCell: 1,
    stepsPerTick: 6,
    params: [
      {
        key: 'model', label: 'Model', type: 'select', default: 'reiter',
        options: [
          { value: 'reiter', label: "Reiter's model (realistic)" },
          { value: 'packard', label: "Packard's snowflake (simple)" },
        ],
      },
      {
        key: 'preset', label: 'Crystal type', type: 'preset',
        options: PRESETS.map(([label, beta, gamma, alpha]) => ({ label, values: { model: 'reiter', beta, gamma, alpha } })),
      },
      { key: 'beta', label: 'Background humidity (β)', type: 'range', min: 0.25, max: 0.98, step: 0.01, default: 0.4, live: true, digits: 2, when: (p) => p.model === 'reiter' },
      { key: 'gamma', label: 'Vapour added per step (γ)', type: 'range', min: 0, max: 0.01, step: 0.0001, default: 0.001, live: true, digits: 4, when: (p) => p.model === 'reiter' },
      { key: 'alpha', label: 'Diffusion (α)', type: 'range', min: 0.2, max: 2.5, step: 0.05, default: 1, live: true, digits: 2, when: (p) => p.model === 'reiter' },
    ],

    create(p, { cols, rows }) {
      const G = hexGrid(cols, rows);
      const { N, nb, edge, nearEdge, lut } = G;
      const frozenAt = new Int32Array(N).fill(-1);
      frozenAt[G.centre] = 0;
      let frozenCount = 1;
      let beta = p.beta, gamma = p.gamma, alpha = p.alpha;
      const reiter = p.model === 'reiter';

      // Reiter: s = amount of water in each cell; s >= 1 means ice.
      let s = new Float32Array(N), s2 = new Float32Array(N);
      const u = new Float32Array(N);
      const receptive = new Uint8Array(N);
      if (reiter) { s.fill(beta); s[G.centre] = 1; }
      let maxIce = 1;

      const sim = {
        generation: 0,
        done: false,
        step() {
          const gen = this.generation + 1;
          if (reiter) {
            // A cell is "receptive" if it is ice or touches ice: it keeps its water.
            for (let i = 0; i < N; i++) {
              let r = s[i] >= 1;
              for (let k = 0; !r && k < 6; k++) { const j = nb[i * 6 + k]; if (j >= 0 && s[j] >= 1) r = true; }
              receptive[i] = r ? 1 : 0;
              u[i] = r ? 0 : s[i];
            }
            let top = 1;
            for (let i = 0; i < N; i++) {
              if (edge[i]) { s2[i] = beta; continue; }
              // Water that isn't held by ice diffuses between neighbours.
              let avg = 0;
              for (let k = 0; k < 6; k++) avg += u[nb[i * 6 + k]];
              avg /= 6;
              let v = u[i] + (alpha / 2) * (avg - u[i]);
              if (receptive[i]) v += s[i] + gamma;
              s2[i] = v;
              if (v >= 1) {
                if (frozenAt[i] < 0) { frozenAt[i] = gen; frozenCount++; if (nearEdge[i]) this.done = true; }
                if (v > top) top = v;
              }
            }
            maxIce = top;
            [s, s2] = [s2, s];
          } else {
            // Packard: a cell freezes when exactly one of its six neighbours is ice.
            const fresh = [];
            for (let i = 0; i < N; i++) {
              if (frozenAt[i] >= 0) continue;
              let k = 0;
              for (let j = 0; j < 6; j++) { const n = nb[i * 6 + j]; if (n >= 0 && frozenAt[n] >= 0) k++; }
              if (k === 1) fresh.push(i);
            }
            for (const i of fresh) { frozenAt[i] = gen; if (nearEdge[i]) this.done = true; }
            frozenCount += fresh.length;
            if (!fresh.length) this.done = true;
          }
          this.generation = gen;
        },
        render(out) {
          const gen = Math.max(1, this.generation);
          const sky = SKY[0];
          for (let px = 0; px < lut.length; px++) {
            const i = lut[px];
            if (i < 0) { out[px] = sky; continue; }
            if (frozenAt[i] >= 0) {
              // Reiter: shade by thickness. Packard: shade by age, giving growth rings.
              const t = reiter
                ? Math.min(1, (s[i] - 1) / Math.max(0.05, maxIce - 1))
                : 1 - frozenAt[i] / gen;
              out[px] = ICE[Math.round(Math.sqrt(Math.max(0, t)) * 255)];
            } else {
              const t = reiter ? Math.min(1, s[i] / Math.max(0.01, beta)) : 0.5;
              out[px] = SKY[Math.round(t * 63)];
            }
          }
        },
        setParam(key, v) {
          if (key === 'beta') beta = v;
          if (key === 'gamma') gamma = v;
          if (key === 'alpha') alpha = v;
        },
        stats() { return `${this.done ? 'Finished · ' : ''}Ice cells ${CA.fmt(frozenCount)}`; },
        label: reiter ? `snowflake-b${beta}-g${gamma}` : 'snowflake-packard',
      };
      return sim;
    },

    info(p) {
      if (p.model === 'packard') {
        return `<p class="small">Each cell is water or ice. A water cell freezes when exactly <strong>one</strong> of its six neighbours is ice; ice never melts. Brighter ice is older, so you can see the growth rings.</p>`;
      }
      return `<p class="small">Humidity (β) is how much water vapour fills the air; γ is a little extra water added to the growing crystal each step. Low humidity grows thin, branching arms; high humidity grows solid plates.</p>
        <p class="small muted">The sliders change the crystal as it grows. Growth stops when it reaches the edge.</p>`;
    },

    about: `
      <p>Snowflakes grow from water vapour freezing onto ice, and because ice crystals are hexagonal, this one uses a grid of hexagons: every cell has six neighbours.</p>
      <p><strong>Reiter's model</strong> (Clifford Reiter, 2005) gives each cell an amount of water. Cells that are ice, or touch ice, keep their water and slowly gain more; everywhere else the water diffuses between neighbours. A cell turns to ice once it holds one unit. Arms grow fastest at their tips because tips reach out into fresh vapour, which is why real snowflakes branch.</p>
      <p><strong>Packard's snowflake</strong> (Norman Packard, 1984) is even simpler: a cell freezes when exactly one neighbour is ice. It grows a fractal snowflake that alternates between full hexagons and spiky stars.</p>`,
  });
})();
