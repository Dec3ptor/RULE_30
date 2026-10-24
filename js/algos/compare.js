(function () {
  'use strict';

  const A_ONLY = CA.hex('#f76b15');
  const B_ONLY = CA.hex('#0b8cf0');
  const { parseRule } = CA.elementary;

  function runner(rule, cols, wrap, seed) {
    let cur = seed.slice(), nxt = new Uint8Array(cols);
    return {
      get row() { return cur; },
      step() {
        for (let i = 0; i < cols; i++) {
          const l = i > 0 ? cur[i - 1] : wrap ? cur[cols - 1] : 0;
          const r = i < cols - 1 ? cur[i + 1] : wrap ? cur[0] : 0;
          nxt[i] = (rule >> ((l << 2) | (cur[i] << 1) | r)) & 1;
        }
        [cur, nxt] = [nxt, cur];
      },
    };
  }

  CA.register({
    id: 'compare',
    name: 'Rule comparison',
    group: '1D',
    tagline: 'Run two elementary rules side by side and highlight where they differ.',
    aspect: 0.55,
    oddCols: true,
    prefill: true,
    defaultCell: 3,
    params: [
      { key: 'a', label: 'Rule A', type: 'text', default: 30, parse: parseRule, random: () => CA.randInt(256), inputmode: 'numeric' },
      { key: 'b', label: 'Rule B', type: 'text', default: 86, parse: parseRule, random: () => CA.randInt(256), inputmode: 'numeric' },
      {
        key: 'flip', label: 'Mirror', type: 'select', default: 'none',
        options: [
          { value: 'none', label: 'Neither' },
          { value: 'a', label: 'Mirror rule A' },
          { value: 'b', label: 'Mirror rule B' },
        ],
      },
      {
        key: 'preset', label: 'Interesting pairs', type: 'preset',
        options: [
          { label: '30 vs 86 (mirror images)', values: { a: 30, b: 86, flip: 'none' } },
          { label: '30 vs 86, mirrored (identical)', values: { a: 30, b: 86, flip: 'b' } },
          { label: '90 vs 150 (two XOR rules)', values: { a: 90, b: 150, flip: 'none' } },
          { label: '110 vs 124 (mirror images)', values: { a: 110, b: 124, flip: 'none' } },
          { label: '18 vs 90 (same from one cell)', values: { a: 18, b: 90, flip: 'none' } },
          { label: '30 vs 45 (two chaotic rules)', values: { a: 30, b: 45, flip: 'none' } },
        ],
      },
      { key: 'start', label: 'Start (same for both)', type: 'select', default: 'single', options: CA.startOptions },
      { key: 'wrap', label: 'Wrap edges', type: 'checkbox', default: true },
    ],

    create(p, { cols, rows }) {
      const seed = new Uint8Array(cols);
      CA.seedRow(seed, p.start);
      const A = runner(p.a, cols, p.wrap, seed);
      const B = runner(p.b, cols, p.wrap, seed);
      const histA = new CA.Strip(cols, rows);
      const histB = new CA.Strip(cols, rows);
      histA.push(A.row);
      histB.push(B.row);
      const flipA = p.flip === 'a', flipB = p.flip === 'b';
      let lastDiff = 0;

      return {
        generation: 0,
        step() {
          A.step();
          B.step();
          histA.push(A.row);
          histB.push(B.row);
          this.generation++;
        },
        render(out, theme) {
          const pal = [theme.bg, A_ONLY, B_ONLY, theme.fg];
          const last = cols - 1;
          let diff = 0, total = 0;
          for (let y = 0; y < rows; y++) {
            const oa = histA.rowOffset(y), ob = histB.rowOffset(y), dst = y * cols;
            if (oa < 0) { out.fill(theme.bg, dst, dst + cols); continue; }
            for (let x = 0; x < cols; x++) {
              const a = histA.buf[oa + (flipA ? last - x : x)];
              const b = histB.buf[ob + (flipB ? last - x : x)];
              out[dst + x] = pal[a | (b << 1)];
              diff += a ^ b;
              total++;
            }
          }
          lastDiff = total ? diff / total : 0;
        },
        stats() {
          return `Cells that differ ${CA.pct(lastDiff)}`;
        },
        label: `rule-${p.a}-vs-${p.b}`,
      };
    },

    info(p) {
      const sw = (c, label) => `<li><span class="swatch" style="background:${c}"></span>${label}</li>`;
      return `
        <div class="pair">${CA.ruleIcon(p.a)}<span class="small muted">Rule A = ${p.a}</span></div>
        <div class="pair">${CA.ruleIcon(p.b)}<span class="small muted">Rule B = ${p.b}</span></div>
        <ul class="legend">
          ${sw('var(--cell-fg)', 'On in both')}
          ${sw('var(--cell-bg)', 'Off in both')}
          ${sw('#f76b15', 'On only in A')}
          ${sw('#0b8cf0', 'On only in B')}
        </ul>`;
    },

    about: `
      <p>Both rules start from the same first row and run at the same time. Cells where they agree are drawn normally; cells where they disagree are coloured by which rule turned them on.</p>
      <p>Mirroring flips one rule's picture left to right. A rule and its mirror image (like 30 and 86) give identical pictures once one of them is mirrored, so the whole canvas goes back to black and white.</p>
      <p>Some different rules agree completely from a single cell and only reveal their differences from a random start. Try 18 vs 90 with both starts.</p>`,
  });
})();
