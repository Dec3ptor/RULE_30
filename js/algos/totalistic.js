(function () {
  'use strict';

  // k = 3 colours, range 1: the new colour depends only on the sum of the
  // three cells (0..6), so a rule is 7 base-3 digits: codes 0..2186.
  const MAX = 2186;
  const MID = CA.hex('#e0861d');

  function table(code) {
    const t = new Uint8Array(7);
    for (let s = 0; s < 7; s++) { t[s] = code % 3; code = Math.floor(code / 3); }
    return t;
  }

  function parseCode(v) {
    v = String(v).trim();
    if (!/^\d{1,4}$/.test(v)) return null;
    const n = parseInt(v, 10);
    return n <= MAX ? n : null;
  }

  CA.register({
    id: 'totalistic',
    name: 'Totalistic (3 colours)',
    group: '1D',
    tagline: 'Three-colour rules that only look at the sum of a neighbourhood.',
    aspect: 0.55,
    oddCols: true,
    prefill: true,
    defaultCell: 3,
    params: [
      { key: 'code', label: `Code (0–${MAX})`, type: 'text', default: 1599, parse: parseCode, random: () => CA.randInt(MAX + 1), inputmode: 'numeric' },
      {
        key: 'preset', label: 'Examples', type: 'preset',
        options: [
          { label: 'Code 1599: settles after ~8,300 steps', values: { code: 1599 } },
          { label: 'Code 1635: branching trees', values: { code: 1635 } },
          { label: 'Code 2040: chaotic', values: { code: 2040 } },
          { label: 'Code 1041: stripes', values: { code: 1041 } },
          { label: 'Code 1428: nested fractal', values: { code: 1428 } },
          { label: 'Code 2049: solid centre column', values: { code: 2049 } },
          { label: 'Code 600: narrow column', values: { code: 600 } },
          { label: 'Code 912: fine triangles', values: { code: 912 } },
        ],
      },
      { key: 'start', label: 'Start', type: 'select', default: 'single', options: CA.startOptions },
    ],

    create(p, { cols, rows }) {
      const t = table(p.code);
      let cur = new Uint8Array(cols), nxt = new Uint8Array(cols);
      CA.seedRow(cur, p.start, 3);
      if (p.start === 'single') { cur.fill(0); cur[cols >> 1] = 1; }
      const strip = new CA.Strip(cols, rows);
      strip.push(cur);

      return {
        generation: 0,
        step() {
          const n = cols;
          for (let i = 0; i < n; i++) {
            const l = i > 0 ? cur[i - 1] : cur[n - 1];
            const r = i < n - 1 ? cur[i + 1] : cur[0];
            nxt[i] = t[l + cur[i] + r];
          }
          [cur, nxt] = [nxt, cur];
          strip.push(cur);
          this.generation++;
        },
        render(out, theme) {
          strip.render(out, [theme.bg, MID, theme.fg]);
        },
        stats() {
          let on = 0;
          for (let i = 0; i < cols; i++) on += cur[i] > 0;
          return `Non-blank ${CA.pct(on / cols)}`;
        },
        label: `code-${p.code}`,
      };
    },

    info(p) {
      const t = table(p.code);
      const colour = ['var(--cell-bg)', '#e0861d', 'var(--cell-fg)'];
      let html = '<div class="tot-table">';
      for (let s = 6; s >= 0; s--) {
        html += `<div class="tt"><span class="mono small">${s}</span><i style="background:${colour[t[s]]}"></i></div>`;
      }
      html += '</div>';
      html += `<p class="mono small">${p.code} = ${Array.from(t).reverse().join('')}<sub>3</sub></p>`;
      html += '<p class="small muted">Top: the sum of the three cells (blank = 0, orange = 1, dark = 2). Bottom: the new colour.</p>';
      return html;
    },

    about: `
      <p>Here each cell has three possible colours, worth 0, 1 and 2. A <em>totalistic</em> rule ignores which neighbour has which colour and only looks at the total of the three cells, which ranges from 0 to 6.</p>
      <p>The rule's code, written in base 3, lists the new colour for each total, from 6 on the left down to 0 on the right. That gives 3<sup>7</sup> = 2187 rules.</p>
      <p>Stephen Wolfram used these rules in <em>A New Kind of Science</em> to show that adding colours doesn't add new kinds of behaviour: you still see the same four classes as the two-colour rules. Code 1599 is a famous example: from a single cell it wanders irregularly for about 8,300 steps before it finally starts repeating.</p>`,
  });
})();
