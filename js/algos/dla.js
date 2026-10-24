(function () {
  'use strict';

  const LUT = CA.gradient(['#f2f5ff', '#7cc4ff', '#3b5bfd', '#8b3fd9', '#e5484d', '#f5a524'], 256);
  const LUT_LIGHT = CA.gradient(['#1b2a6b', '#3b5bfd', '#1fa5a0', '#e0861d', '#e5484d'], 256);

  CA.register({
    id: 'dla',
    name: 'Crystal growth (DLA)',
    group: 'Nature',
    tagline: 'Wandering particles stick on contact, growing branching fractal clusters.',
    aspect: 0.75,
    defaultCell: 2,
    stepsPerTick: 40,
    genLabel: 'Particles',
    paintable: true,
    params: [
      {
        key: 'seed', label: 'Grow from', type: 'select', default: 'point',
        options: [
          { value: 'point', label: 'A single seed in the middle' },
          { value: 'line', label: 'The floor (like frost or coral)' },
        ],
      },
      { key: 'stick', label: 'Stickiness', type: 'range', min: 0.02, max: 1, step: 0.01, default: 1, live: true, digits: 2 },
    ],

    create(p, { cols, rows }) {
      const N = cols * rows;
      const order = new Int32Array(N); // 0 = empty, otherwise the particle's arrival number
      let count = 0, stick = p.stick;
      const cx = cols >> 1, cy = rows >> 1;
      const line = p.seed === 'line';
      let maxR = 1, topY = rows - 1;
      const add = (x, y) => {
        order[y * cols + x] = ++count;
        if (line) topY = Math.min(topY, y);
        else maxR = Math.max(maxR, Math.hypot(x - cx, y - cy));
      };
      if (line) for (let x = 0; x < cols; x++) add(x, rows - 1);
      else add(cx, cy);
      const limitR = Math.min(cx, cy) - 3;

      const touching = (x, y) => {
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= rows) continue;
          for (let dx = -1; dx <= 1; dx++) {
            let xx = x + dx;
            if (line) xx = (xx + cols) % cols; else if (xx < 0 || xx >= cols) continue;
            if (order[yy * cols + xx]) return true;
          }
        }
        return false;
      };

      return {
        generation: 0,
        done: false,
        // One step = release one particle and let it wander until it sticks.
        step() {
          let x, y;
          const launch = () => {
            if (line) { y = Math.max(0, topY - 6); x = CA.randInt(cols); }
            else { const a = Math.random() * Math.PI * 2, r = maxR + 5; x = Math.round(cx + Math.cos(a) * r); y = Math.round(cy + Math.sin(a) * r); }
          };
          launch();
          for (let moves = 0; moves < 2e6; moves++) {
            // Far from the cluster, take one big random jump instead of many small steps.
            const gap = line ? topY - y - 3 : Math.hypot(x - cx, y - cy) - maxR - 3;
            if (gap > 2) {
              const a = Math.random() * Math.PI * 2;
              x = Math.round(x + Math.cos(a) * gap);
              y = Math.round(y + Math.sin(a) * gap);
            } else {
              const d = Math.random() * 4 | 0;
              if (d === 0) x++; else if (d === 1) x--; else if (d === 2) y++; else y--;
            }
            if (line) {
              x = ((x % cols) + cols) % cols;
              if (y < topY - 30 || y < 0) { launch(); continue; }
              if (y >= rows) y = rows - 1;
            } else if (x < 1 || y < 1 || x >= cols - 1 || y >= rows - 1 || Math.hypot(x - cx, y - cy) > maxR * 2 + 20) {
              launch();
              continue;
            }
            if (!order[y * cols + x] && touching(x, y) && Math.random() < stick) {
              add(x, y);
              break;
            }
          }
          this.generation = count;
          if (line ? topY <= 2 : maxR >= limitR) this.done = true;
        },
        render(out, theme) {
          const dark = (theme.bg & 255) < 128;
          const lut = dark ? LUT : LUT_LIGHT;
          const total = Math.max(1, count);
          for (let i = 0; i < N; i++) {
            const o = order[i];
            out[i] = o ? lut[Math.min(255, ((o / total) * 255) | 0)] : theme.bg;
          }
        },
        setParam(key, v) { if (key === 'stick') stick = v; },
        paint(x, y) {
          if (!order[y * cols + x]) add(x, y);
          this.done = false;
        },
        stats() { return `${this.done ? 'Finished · ' : ''}Size ${line ? CA.fmt(rows - topY) + ' tall' : CA.fmt(maxR) + ' radius'}`; },
        label: `dla-${p.seed}`,
      };
    },

    info() {
      return `<p class="small">Colour shows when each particle arrived, from the first (centre) to the newest (tips). New particles almost never reach the inner branches: the tips catch them first, which is what makes the shape a fractal.</p>
        <p class="small muted">Lower stickiness gives denser, fuzzier clusters. Turn on Draw to add more seeds.</p>`;
    },

    about: `
      <p>Diffusion-limited aggregation (Thomas Witten and Leonard Sander, 1981): particles drift in one at a time on a random walk, and as soon as one touches the cluster it sticks there for good.</p>
      <p>Because a wandering particle is far more likely to bump into a tip than to sneak deep between branches, tips grow faster and faster and the cluster branches like a tree. The result is a fractal with a dimension of about 1.71: more than a line, less than a filled area.</p>
      <p>The same process shapes frost on windows, mineral dendrites in rock, electrodeposited metals, lightning-like discharge patterns and some coral and bacterial colonies.</p>`,
  });
})();
