(function () {
  'use strict';

  // Parse "B3/S23" or "B2/S/C3" (Generations: C = number of states).
  // Also accepts the older "23/3" (survive/birth) notation.
  function parseRule(v) {
    const s = String(v).trim().toUpperCase().replace(/\s+/g, '');
    let birth, survive, states = 2, m;
    if ((m = s.match(/^B([0-8]*)\/S([0-8]*)(?:\/(?:C|G)?(\d+))?$/))) {
      [, birth, survive] = m;
      if (m[3]) states = parseInt(m[3], 10);
    } else if ((m = s.match(/^S?([0-8]*)\/B?([0-8]*)(?:\/(\d+))?$/))) {
      [, survive, birth] = m;
      if (m[3]) states = parseInt(m[3], 10);
    } else {
      return null;
    }
    if (states < 2 || states > 64) return null;
    const norm = (d) => [...new Set(d)].sort().join('');
    return `B${norm(birth)}/S${norm(survive)}${states > 2 ? '/C' + states : ''}`;
  }

  function compile(rule) {
    const m = rule.match(/^B([0-8]*)\/S([0-8]*)(?:\/C(\d+))?$/);
    const b = new Uint8Array(9), s = new Uint8Array(9);
    for (const d of m[1]) b[+d] = 1;
    for (const d of m[2]) s[+d] = 1;
    return { b, s, states: m[3] ? +m[3] : 2 };
  }

  const RULES = [
    ['B3/S23', "Conway's Game of Life"],
    ['B36/S23', 'HighLife (has a replicator)'],
    ['B2/S', 'Seeds (explosive)'],
    ['B3678/S34678', 'Day & Night'],
    ['B3/S12345', 'Maze'],
    ['B3/S45678', 'Coral'],
    ['B1357/S1357', 'Replicator'],
    ['B35678/S5678', 'Diamoeba'],
    ['B4678/S35678', 'Anneal'],
    ['B36/S125', '2x2'],
    ['B368/S245', 'Morley'],
    ['B3/S012345678', 'Life without Death'],
    ['B2/S/C3', "Brian's Brain"],
    ['B2/S345/C4', 'Star Wars'],
    ['B34/S12/C3', 'Frogs'],
    ['B24/S345/C25', 'Bombers'],
  ];

  const PATTERNS = {
    rpent: 'b2o$2o$bo!',
    acorn: 'bo$3bo$2o2b3o!',
    diehard: '6bo$2o$bo3b3o!',
    gun: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!',
    replicator: '2b3o$bo2bo$o3bo$o2bo$3o!',
  };

  CA.register({
    id: 'life',
    name: 'Game of Life',
    group: '2D',
    tagline: "Conway's Life and other birth/survival rules, including Brian's Brain.",
    aspect: 0.75,
    defaultCell: 4,
    paintable: true,
    params: [
      {
        key: 'preset', label: 'Rule family', type: 'preset',
        options: RULES.map(([rule, name]) => ({ label: name, values: { rule } })),
      },
      { key: 'rule', label: 'Rule (B…/S… or B…/S…/C…)', type: 'text', default: 'B3/S23', parse: parseRule },
      {
        key: 'start', label: 'Start', type: 'select', default: 'random',
        options: [
          { value: 'random', label: 'Random soup' },
          { value: 'rpent', label: 'R-pentomino' },
          { value: 'acorn', label: 'Acorn' },
          { value: 'diehard', label: 'Diehard' },
          { value: 'gun', label: 'Gosper glider gun' },
          { value: 'replicator', label: 'HighLife replicator' },
          { value: 'line', label: 'Horizontal line' },
          { value: 'empty', label: 'Empty (draw your own)' },
        ],
      },
      { key: 'density', label: 'Soup density', type: 'range', min: 2, max: 90, step: 1, default: 30, unit: '%', when: (p) => p.start === 'random' },
      { key: 'wrap', label: 'Wrap edges', type: 'checkbox', default: true },
    ],

    create(p, { cols, rows }) {
      const { b, s, states } = compile(p.rule);
      const W = cols + 2, H = rows + 2;
      let grid = new Uint8Array(cols * rows), next = new Uint8Array(cols * rows);
      const mask = new Uint8Array(W * H); // live cells with a 1-cell border

      if (p.start === 'random') {
        const d = p.density / 100;
        for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < d ? 1 : 0;
      } else if (p.start === 'line') {
        const y = rows >> 1, w = Math.floor(cols * 0.6), x0 = (cols - w) >> 1;
        grid.fill(1, y * cols + x0, y * cols + x0 + w);
      } else if (PATTERNS[p.start]) {
        CA.stamp(grid, cols, rows, CA.parseRLE(PATTERNS[p.start]));
      }

      let pop = 0;
      const countPop = () => { pop = 0; for (let i = 0; i < grid.length; i++) pop += grid[i] === 1; };
      countPop();

      return {
        generation: 0,
        step() {
          // Copy live cells into the bordered mask.
          for (let y = 0; y < rows; y++) {
            const src = y * cols, dst = (y + 1) * W + 1;
            for (let x = 0; x < cols; x++) mask[dst + x] = grid[src + x] === 1 ? 1 : 0;
          }
          if (p.wrap) {
            for (let y = 1; y <= rows; y++) {
              mask[y * W] = mask[y * W + cols];
              mask[y * W + cols + 1] = mask[y * W + 1];
            }
            mask.copyWithin(0, rows * W, rows * W + W);
            mask.copyWithin((rows + 1) * W, W, 2 * W);
          }
          pop = 0;
          for (let y = 0; y < rows; y++) {
            const up = y * W + 1, mid = up + W, dn = mid + W, row = y * cols;
            for (let x = 0; x < cols; x++) {
              const n =
                mask[up + x - 1] + mask[up + x] + mask[up + x + 1] +
                mask[mid + x - 1] + mask[mid + x + 1] +
                mask[dn + x - 1] + mask[dn + x] + mask[dn + x + 1];
              const c = grid[row + x];
              let v;
              if (c === 0) v = b[n] ? 1 : 0;
              else if (c === 1) v = s[n] ? 1 : states > 2 ? 2 : 0;
              else v = c + 1 >= states ? 0 : c + 1;
              next[row + x] = v;
              pop += v === 1;
            }
          }
          [grid, next] = [next, grid];
          this.generation++;
        },
        render(out, theme) {
          const pal = new Uint32Array(states);
          pal[0] = theme.bg;
          pal[1] = theme.fg;
          const fade = CA.hex('#4f7cff');
          for (let k = 2; k < states; k++) pal[k] = CA.mix(fade, theme.bg, (k - 2) / (states - 1));
          for (let i = 0; i < grid.length; i++) out[i] = pal[grid[i]];
        },
        paint(x, y, erase) {
          grid[y * cols + x] = erase ? 0 : 1;
          countPop();
        },
        isAlive(x, y) { return grid[y * cols + x] === 1; },
        stats() { return `Population ${CA.fmt(pop)}`; },
        label: p.rule.replace(/\//g, '-'),
      };
    },

    info(p) {
      const { b, s, states } = compile(p.rule);
      const list = (arr) => { const d = []; arr.forEach((v, i) => v && d.push(i)); return d.length ? d.join(', ') : 'never'; };
      const name = (RULES.find(([r]) => r === p.rule) || [])[1];
      let html = name ? `<p><strong>${CA.esc(name)}</strong></p>` : '';
      html += `<p class="small">A dead cell is <strong>born</strong> with ${list(b)} live neighbours.<br>A live cell <strong>survives</strong> with ${list(s)}.</p>`;
      if (states > 2) html += `<p class="small">Cells that die fade through ${states - 2} dying state${states > 3 ? 's' : ''} (shown in blue) before they can be born again.</p>`;
      html += '<p class="small muted">Turn on Draw to add or erase cells.</p>';
      return html;
    },

    about: `
      <p>John Conway's Game of Life (1970) runs on a grid of square cells. Each cell looks at its eight neighbours: a dead cell with exactly 3 live neighbours is born, and a live cell with 2 or 3 survives. Everything else dies or stays empty. From those two rules come gliders, oscillators, guns and even working computers.</p>
      <p>Change the numbers and you get a whole family of "Life-like" rules, written as B (birth) and S (survival) counts. Conway's Life is B3/S23. HighLife (B36/S23) has a pattern that copies itself; Seeds (B2/S) explodes; Day &amp; Night (B3678/S34678) treats live and dead cells the same way.</p>
      <p>Adding /C<em>n</em> makes it a "Generations" rule: dying cells spend a few steps fading out and can't be reborn until they're gone. Brian's Brain (B2/S/C3) is the best-known example, full of fast-moving spaceships.</p>`,
  });
})();
