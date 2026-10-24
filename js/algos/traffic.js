(function () {
  'use strict';

  // Speed colours: stopped (red) through amber to full speed (green).
  const SPEED_STOPS = ['#e5484d', '#f08c2e', '#e9c73b', '#8fc93a', '#2f9e5b'];

  CA.register({
    id: 'traffic',
    name: 'Traffic jams',
    group: '1D',
    tagline: 'Cars on a ring road. Watch phantom jams appear and drift backwards.',
    aspect: 0.55,
    prefill: true,
    defaultCell: 3,
    params: [
      {
        key: 'preset', label: 'Examples', type: 'preset',
        options: [
          { label: 'Light traffic flows freely', values: { density: 8, dawdle: 0.2, vmax: 5, start: 'random' } },
          { label: 'Busy: phantom jams', values: { density: 18, dawdle: 0.2, vmax: 5, start: 'random' } },
          { label: 'Gridlock', values: { density: 50, dawdle: 0.2, vmax: 5, start: 'random' } },
          { label: 'A jam dissolving', values: { density: 15, dawdle: 0.1, vmax: 5, start: 'jam' } },
          { label: 'Rule 184 (no braking, speed 1)', values: { density: 40, dawdle: 0, vmax: 1, start: 'random' } },
        ],
      },
      { key: 'density', label: 'Cars on the road', type: 'range', min: 2, max: 80, step: 1, default: 18, unit: '%' },
      { key: 'dawdle', label: 'Random braking chance', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.2, live: true, digits: 2 },
      { key: 'vmax', label: 'Speed limit (cells per step)', type: 'range', min: 1, max: 9, step: 1, default: 5, live: true },
      {
        key: 'start', label: 'Start', type: 'select', default: 'random',
        options: [
          { value: 'random', label: 'Cars spread at random' },
          { value: 'jam', label: 'One big jam' },
        ],
      },
    ],

    create(p, { cols, rows }) {
      const L = cols;
      const n = Math.max(1, Math.min(L - 1, Math.round((L * p.density) / 100)));
      let vmax = p.vmax, dawdle = p.dawdle;
      // Cars stay in order around the ring (no overtaking), so keep them in arrays.
      const pos = new Int32Array(n), vel = new Int32Array(n);
      if (p.start === 'jam') {
        for (let i = 0; i < n; i++) pos[i] = i;
      } else {
        const cells = Array.from({ length: L }, (_, i) => i);
        for (let i = L - 1; i > 0; i--) { const j = CA.randInt(i + 1); [cells[i], cells[j]] = [cells[j], cells[i]]; }
        const chosen = cells.slice(0, n).sort((a, b) => a - b);
        for (let i = 0; i < n; i++) { pos[i] = chosen[i]; vel[i] = CA.randInt(vmax + 1); }
      }
      const row = new Uint8Array(L);
      const strip = new CA.Strip(L, rows);
      const paint = () => {
        row.fill(0);
        for (let i = 0; i < n; i++) row[pos[i]] = 1 + Math.min(vel[i], 9);
        strip.push(row);
      };
      paint();
      let lastAvg = 0;

      return {
        generation: 0,
        step() {
          // Nagel-Schreckenberg: accelerate, keep a safe gap, randomly brake, move.
          let sum = 0;
          for (let i = 0; i < n; i++) {
            const ahead = pos[(i + 1) % n];
            const gap = n === 1 ? L - 1 : (ahead - pos[i] - 1 + L) % L;
            let v = Math.min(vel[i] + 1, vmax);
            if (v > gap) v = gap;
            if (v > 0 && Math.random() < dawdle) v--;
            vel[i] = v;
            sum += v;
          }
          for (let i = 0; i < n; i++) pos[i] = (pos[i] + vel[i]) % L;
          lastAvg = sum / n;
          paint();
          this.generation++;
        },
        render(out, theme) {
          const pal = [theme.bg];
          const lut = CA.gradient(SPEED_STOPS, vmax + 1);
          for (let v = 0; v <= 9; v++) pal.push(lut[Math.min(v, vmax)]);
          strip.render(out, pal);
        },
        setParam(key, v) {
          if (key === 'vmax') vmax = v;
          if (key === 'dawdle') dawdle = v;
        },
        stats() {
          const flow = (lastAvg * n) / L;
          return `Average speed ${lastAvg.toFixed(2)} · Flow ${flow.toFixed(3)} cars/step`;
        },
        label: `traffic-${p.density}pct`,
      };
    },

    info(p) {
      const stops = SPEED_STOPS.join(', ');
      return `<div class="speed-bar" style="background:linear-gradient(to right, ${stops})"></div>
        <div class="speed-labels small muted"><span>Stopped</span><span>Speed ${p.vmax}</span></div>
        <p class="small">Time runs down the page and cars drive to the right. Red streaks are jams; notice that they creep <em>backwards</em> while the cars in them keep moving forward.</p>
        <p class="small muted">Braking chance and speed limit change live, without a restart.</p>`;
    },

    about: `
      <p>The Nagel–Schreckenberg model (1992) puts cars on a one-lane ring road divided into cells. Every step, each car follows four rules: speed up by one (up to the limit), slow down to avoid the car in front, sometimes brake for no reason, then move.</p>
      <p>That random braking is enough to create "phantom" traffic jams: nobody crashed and nothing blocks the road, yet a knot of stopped cars forms and drifts backwards against the flow. Real motorways do exactly this.</p>
      <p>With no random braking and a speed limit of one cell per step, the model is exactly elementary rule 184.</p>`,
  });
})();
