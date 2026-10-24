(function () {
  'use strict';

  const TC = 2 / Math.log(1 + Math.SQRT2); // critical temperature, about 2.269

  CA.register({
    id: 'ising',
    name: 'Ising magnet',
    group: 'Nature',
    tagline: 'Tiny magnets that try to line up with their neighbours, fighting against heat.',
    aspect: 0.75,
    defaultCell: 3,
    genLabel: 'Sweep',
    evenGrid: true,
    paintable: true,
    params: [
      {
        key: 'preset', label: 'Temperature', type: 'preset',
        options: [
          { label: 'Cold: domains grow', values: { temp: 1.5, field: 0 } },
          { label: 'Critical point (≈ 2.27)', values: { temp: 2.27, field: 0 } },
          { label: 'Hot: disordered', values: { temp: 3.5, field: 0 } },
          { label: 'Cold, with a magnetic field', values: { temp: 1.8, field: 0.1 } },
        ],
      },
      { key: 'temp', label: 'Temperature', type: 'range', min: 0.5, max: 5, step: 0.01, default: 2.27, live: true, digits: 2 },
      { key: 'field', label: 'External magnetic field', type: 'range', min: -1, max: 1, step: 0.01, default: 0, live: true, digits: 2 },
      {
        key: 'start', label: 'Start', type: 'select', default: 'random',
        options: [
          { value: 'random', label: 'Random (infinitely hot)' },
          { value: 'up', label: 'All pointing up' },
        ],
      },
    ],

    create(p, { cols, rows }) {
      const N = cols * rows;
      const spin = new Uint8Array(N); // 1 = up, 0 = down
      if (p.start === 'up') spin.fill(1);
      else for (let i = 0; i < N; i++) spin[i] = Math.random() < 0.5 ? 1 : 0;
      let T = p.temp, h = p.field;
      // Flip probability for each (spin, sum of 4 neighbours) pair: Metropolis rule.
      const prob = new Float64Array(2 * 9);
      const updateProb = () => {
        for (let s = 0; s < 2; s++) {
          for (let sum = -4; sum <= 4; sum++) {
            const dE = 2 * (s ? 1 : -1) * (sum + h);
            prob[s * 9 + sum + 4] = dE <= 0 ? 1 : Math.exp(-dE / T);
          }
        }
      };
      updateProb();
      const xl = new Int32Array(cols), xr = new Int32Array(cols);
      for (let x = 0; x < cols; x++) { xl[x] = (x - 1 + cols) % cols; xr[x] = (x + 1) % cols; }
      let up = 0;
      const countUp = () => { up = 0; for (let i = 0; i < N; i++) up += spin[i]; };
      countUp();

      return {
        generation: 0,
        step() {
          // Checkerboard update: half the cells at a time, so neighbours never flip together.
          for (let parity = 0; parity < 2; parity++) {
            for (let y = 0; y < rows; y++) {
              const row = y * cols, u = ((y - 1 + rows) % rows) * cols, d = ((y + 1) % rows) * cols;
              for (let x = (y + parity) & 1; x < cols; x += 2) {
                const i = row + x;
                const sum = 2 * (spin[row + xl[x]] + spin[row + xr[x]] + spin[u + x] + spin[d + x]) - 4;
                const s = spin[i];
                if (Math.random() < prob[s * 9 + sum + 4]) spin[i] = 1 - s;
              }
            }
          }
          countUp();
          this.generation++;
        },
        render(out, theme) {
          for (let i = 0; i < N; i++) out[i] = spin[i] ? theme.fg : theme.bg;
        },
        setParam(key, v) {
          if (key === 'temp') T = v;
          if (key === 'field') h = v;
          updateProb();
        },
        paint(x, y, erase) { spin[y * cols + x] = erase ? 0 : 1; },
        isAlive(x, y) { return spin[y * cols + x] === 1; },
        stats() {
          const m = (2 * up - N) / N;
          return `Magnetisation ${m >= 0 ? '+' : '−'}${Math.abs(m).toFixed(3)}`;
        },
        label: `ising-T${T}`,
      };
    },

    info(p) {
      const phase = p.temp < TC - 0.05 ? 'below' : p.temp > TC + 0.05 ? 'above' : 'right at';
      return `<ul class="legend">
          <li><span class="swatch" style="background:var(--cell-fg)"></span>Pointing up</li>
          <li><span class="swatch" style="background:var(--cell-bg)"></span>Pointing down</li>
        </ul>
        <p class="small">Temperature ${p.temp.toFixed(2)} is ${phase} the critical temperature (≈ ${TC.toFixed(3)}). Below it, regions that agree grow until one direction wins. Above it, heat keeps everything jumbled.</p>
        <p class="small muted">The sliders work live. Turn on Draw to flip magnets by hand.</p>`;
    },

    about: `
      <p>The Ising model (Wilhelm Lenz and Ernst Ising, 1920s) is the classic model of a magnet. Each cell is a tiny magnet pointing up or down. Neighbours that agree have lower energy, so they like to line up, but heat makes them flip at random.</p>
      <p>Each step tries to flip every magnet using the Metropolis rule: a flip that lowers the energy always happens, and one that raises it happens with a probability that shrinks as the temperature drops.</p>
      <p>Cold, and the magnets organise into growing domains: the material becomes magnetised. Hot, and they stay disordered. Right at the critical temperature (Lars Onsager worked out its exact value, 2 / ln(1 + √2) ≈ 2.269) you see clusters of every size, a famous example of a phase transition.</p>`,
  });
})();
