(function () {
  'use strict';

  const COLORS = ['#2f6fde', '#f2b33d', '#c8364a'].map(CA.hex);

  CA.register({
    id: 'sandpile',
    name: 'Sandpile',
    group: 'Nature',
    tagline: 'Pile up sand grains; any cell with 4 or more topples onto its neighbours.',
    aspect: 0.75,
    defaultCell: 2,
    stepsPerTick: 60,
    genLabel: 'Sweep',
    paintable: true,
    params: [
      {
        key: 'grains', label: 'Grains dropped in the middle', type: 'select', default: 'fit',
        options: [
          { value: 'fit', label: 'Enough to fill the canvas' },
          { value: '4096', label: '4,096' },
          { value: '16384', label: '16,384' },
          { value: '65536', label: '65,536' },
          { value: '262144', label: '262,144' },
          { value: '0', label: 'None (tap to drop sand)' },
        ],
      },
      {
        key: 'base', label: 'Background', type: 'select', default: '0',
        options: [
          { value: '0', label: 'Empty' },
          { value: '2', label: '2 grains everywhere' },
          { value: '3', label: '3 grains everywhere (critical)' },
        ],
      },
    ],

    create(p, { cols, rows }) {
      const h = new Int32Array(cols * rows);
      if (p.base !== '0') h.fill(+p.base);
      let grains = p.grains === 'fit'
        ? Math.round(2.1 * Math.PI * (0.47 * Math.min(cols, rows)) ** 2)
        : +p.grains;
      if (p.base === '3' && p.grains === 'fit') grains = 4; // a single grain is enough to start an avalanche
      const cx = cols >> 1, cy = rows >> 1;
      h[cy * cols + cx] += grains;
      // Only sweep the area that might be unstable.
      let x0 = cx, x1 = cx, y0 = cy, y1 = cy;
      let topples = 0;
      if (p.base !== '0') { x0 = 0; x1 = cols - 1; y0 = 0; y1 = rows - 1; }

      return {
        generation: 0,
        done: false,
        step() {
          let any = false;
          let nx0 = cols, nx1 = -1, ny0 = rows, ny1 = -1;
          for (let y = y0; y <= y1; y++) {
            const row = y * cols;
            for (let x = x0; x <= x1; x++) {
              const i = row + x;
              const v = h[i];
              if (v < 4) continue;
              const q = v >> 2;
              h[i] = v & 3;
              topples += q;
              any = true;
              if (x > 0) h[i - 1] += q;
              if (x < cols - 1) h[i + 1] += q;
              if (y > 0) h[i - cols] += q;
              if (y < rows - 1) h[i + cols] += q;
              if (x < nx0) nx0 = x;
              if (x > nx1) nx1 = x;
              if (y < ny0) ny0 = y;
              if (y > ny1) ny1 = y;
            }
          }
          if (any) {
            x0 = Math.max(0, nx0 - 1); x1 = Math.min(cols - 1, nx1 + 1);
            y0 = Math.max(0, ny0 - 1); y1 = Math.min(rows - 1, ny1 + 1);
            this.generation++;
          }
          this.done = !any;
        },
        render(out, theme) {
          const pal = [theme.bg, COLORS[0], COLORS[1], COLORS[2]];
          const busy = CA.mix(theme.bg, theme.fg, 0.2);
          for (let i = 0; i < h.length; i++) out[i] = h[i] < 4 ? pal[h[i]] : busy;
        },
        paintOnce: true,
        paint(x, y) {
          h[y * cols + x] += 2000;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x);
          y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          this.done = false;
        },
        stats() {
          let total = 0;
          for (let i = 0; i < h.length; i++) total += h[i];
          return `${this.done ? 'Stable · ' : ''}Grains ${CA.fmt(total)} · Topples ${CA.fmt(topples)}`;
        },
        label: `sandpile-${grains}`,
      };
    },

    info() {
      return `<ul class="legend">
          <li><span class="swatch" style="background:var(--cell-bg)"></span>0 grains</li>
          <li><span class="swatch" style="background:#2f6fde"></span>1 grain</li>
          <li><span class="swatch" style="background:#f2b33d"></span>2 grains</li>
          <li><span class="swatch" style="background:#c8364a"></span>3 grains</li>
          <li><span class="swatch" style="background:var(--cell-busy)"></span>4 or more (still toppling)</li>
        </ul>
        <p class="small muted">Turn on Draw and tap to drop 2,000 more grains. Sand that falls off the edge is lost.</p>`;
    },

    about: `
      <p>The Abelian sandpile (Bak, Tang and Wiesenfeld, 1987) drops grains of sand onto a grid. Whenever a cell holds 4 or more grains it <em>topples</em>, sending one grain to each of its four neighbours, which may make them topple too.</p>
      <p>Drop a big pile in one spot and let it settle: the result is an intricate fractal, and it's the same no matter what order the topples happen in. That order-independence is what "Abelian" means.</p>
      <p>Sandpiles are the classic example of <em>self-organised criticality</em>. On the critical background (3 grains everywhere) a single extra grain can set off an avalanche of any size, a model for earthquakes, forest fires and stock market crashes.</p>`,
  });
})();
