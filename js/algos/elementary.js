(function () {
  'use strict';

  const NOTES = {
    0: 'Every cell dies after one step. A class 1 rule.',
    4: 'Only an isolated live cell (010) survives, so patterns freeze immediately.',
    18: 'From one cell it draws a Sierpinski triangle. From random starts it is chaotic (class 3), full of triangles of every size.',
    22: 'A cell turns on when exactly one of its three cells is on. One cell grows into a nested, fractal pattern; random starts look chaotic.',
    30: 'Famous for chaotic, complex behaviour from a single cell. Its new value is left XOR (centre OR right). The centre column looks random enough that Wolfram used it as a random number generator in Mathematica.',
    45: 'Another chaotic (class 3) rule. From one cell it grows a lopsided, noisy triangle.',
    51: 'Every cell flips each step (NOT centre), so the pattern blinks.',
    54: 'Mixes order and randomness, with gliders that collide and interact. Often named as a possible class 4 rule.',
    60: 'An additive rule: left XOR centre. It draws a Sierpinski triangle leaning to one side.',
    90: 'An additive rule: left XOR right. From one cell it draws the Sierpinski triangle, a classic fractal.',
    102: 'Centre XOR right. The mirror image of rule 60.',
    105: 'NOT (left XOR centre XOR right). The complement of rule 150, and additive too.',
    110: 'Proved Turing complete by Matthew Cook (published 2004). Gliders move through a periodic background and collide in complicated ways. The best-known class 4 rule.',
    126: 'A cell turns on unless all three cells match. From one cell it draws a thick Sierpinski triangle.',
    150: 'An additive rule: left XOR centre XOR right. From one cell it draws an intricate nested pattern.',
    170: 'Copies the right neighbour, so everything shifts one cell left each step.',
    184: 'A simple model of traffic flow: each car moves right if the cell ahead is empty. Also used in particle physics and density classification.',
    204: 'The identity rule: nothing ever changes.',
    232: 'The majority rule: each cell takes the most common value of its three cells. Random starts freeze into stripes.',
    240: 'Copies the left neighbour, so everything shifts one cell right each step.',
    250: 'Left OR right. From one cell it draws a triangle with a checkerboard inside.',
    254: 'A cell turns on if any of its three cells is on. One cell grows into a solid triangle.',
  };

  const bit = (rule, n) => (rule >> n) & 1;

  // Swap left and right in every neighbourhood.
  function mirror(rule) {
    let m = 0;
    for (let n = 0; n < 8; n++) {
      const l = (n >> 2) & 1, c = (n >> 1) & 1, r = n & 1;
      m |= bit(rule, (r << 2) | (c << 1) | l) << n;
    }
    return m;
  }

  // Swap the roles of 0 and 1.
  function complement(rule) {
    let m = 0;
    for (let n = 0; n < 8; n++) m |= (1 - bit(rule, 7 - n)) << n;
    return m;
  }

  // Accept 0-255 or an 8-digit binary string, like the original page did.
  function parseRule(v) {
    v = String(v).trim();
    if (/^[01]{8}$/.test(v)) return parseInt(v, 2);
    if (/^\d{1,3}$/.test(v)) {
      const n = parseInt(v, 10);
      if (n >= 0 && n <= 255) return n;
    }
    return null;
  }

  // The first `steps` cells of the centre column, from a single cell on an unbounded line.
  function centreColumn(rule, steps) {
    const w = steps * 2 + 3;
    let cur = new Uint8Array(w), nxt = new Uint8Array(w);
    cur[w >> 1] = 1;
    const out = [1];
    for (let s = 1; s < steps; s++) {
      for (let i = 1; i < w - 1; i++) nxt[i] = bit(rule, (cur[i - 1] << 2) | (cur[i] << 1) | cur[i + 1]);
      [cur, nxt] = [nxt, cur];
      out.push(cur[w >> 1]);
    }
    return out.join('');
  }

  // Shared with the comparison view.
  CA.elementary = { mirror, complement, parseRule, NOTES };

  CA.ruleIcon = function (rule) {
    let html = '<div class="rule-icon" aria-label="Rule table">';
    for (let n = 7; n >= 0; n--) {
      const cells = [(n >> 2) & 1, (n >> 1) & 1, n & 1].map((b) => `<i class="${b ? 'on' : ''}"></i>`).join('');
      html += `<div class="ri"><div class="ri-in">${cells}</div><div class="ri-out"><i class="${bit(rule, n) ? 'on' : ''}"></i></div></div>`;
    }
    return html + '</div>';
  };

  CA.register({
    id: 'elementary',
    name: 'Elementary',
    group: '1D',
    tagline: 'The 256 one-dimensional rules, including Rule 30, 90 and 110.',
    aspect: 0.55,
    oddCols: true,
    prefill: true,
    defaultCell: 3,
    params: [
      { key: 'rule', label: 'Rule (0–255 or 8-bit binary)', type: 'text', default: 30, parse: parseRule, random: () => CA.randInt(256), inputmode: 'numeric' },
      {
        key: 'preset', label: 'Famous rules', type: 'preset',
        options: [30, 110, 90, 45, 54, 150, 184, 60, 22, 18, 126, 250].map((r) => ({ label: `Rule ${r}`, values: { rule: r } })),
      },
      { key: 'start', label: 'Start', type: 'select', default: 'single', options: CA.startOptions },
      { key: 'wrap', label: 'Wrap edges', type: 'checkbox', default: true },
    ],

    create(p, { cols, rows }) {
      const rule = p.rule;
      let cur = new Uint8Array(cols), nxt = new Uint8Array(cols);
      CA.seedRow(cur, p.start);
      const strip = new CA.Strip(cols, rows);
      strip.push(cur);
      const wrap = p.wrap;

      return {
        generation: 0,
        step() {
          const n = cols;
          for (let i = 0; i < n; i++) {
            const l = i > 0 ? cur[i - 1] : wrap ? cur[n - 1] : 0;
            const r = i < n - 1 ? cur[i + 1] : wrap ? cur[0] : 0;
            nxt[i] = (rule >> ((l << 2) | (cur[i] << 1) | r)) & 1;
          }
          [cur, nxt] = [nxt, cur];
          strip.push(cur);
          this.generation++;
        },
        render(out, theme) {
          strip.render(out, [theme.bg, theme.fg]);
        },
        stats() {
          let on = 0;
          for (let i = 0; i < cols; i++) on += cur[i];
          return `Density ${CA.pct(on / cols)}`;
        },
        label: `rule-${rule}`,
      };
    },

    info(p) {
      const r = p.rule;
      const m = mirror(r), c = complement(r), mc = complement(m);
      const eq = [
        [r, 'this rule'], [m, 'mirror'], [c, 'complement'], [mc, 'mirror + complement'],
      ];
      const seen = new Set();
      const list = eq
        .filter(([n]) => (seen.has(n) ? false : (seen.add(n), true)))
        .map(([n, why]) => `<button class="link" data-param="rule" data-value="${n}">${n}</button> <span class="muted">(${why})</span>`)
        .join(', ');
      let html = CA.ruleIcon(r);
      html += `<p class="mono small">${r} = ${r.toString(2).padStart(8, '0')}<sub>2</sub></p>`;
      html += `<p>${NOTES[r] ? CA.esc(NOTES[r]) : 'No notes for this rule yet. Try its mirror or complement, or compare it with another rule.'}</p>`;
      html += `<p class="small">Equivalent rules: ${list}.</p>`;
      if (p.start === 'single') {
        html += `<p class="small">Centre column, first 64 steps:</p><p class="mono small bits">${centreColumn(r, 64)}</p>`;
      }
      return html;
    },

    about: `
      <p>Elementary cellular automata are the simplest class of one-dimensional automata. Each cell is either 0 or 1, and its next value depends only on itself and its two neighbours.</p>
      <p>Three cells give 2<sup>3</sup> = 8 possible neighbourhoods, and a rule assigns an output to each one, so there are 2<sup>8</sup> = 256 rules. The rule number is those 8 outputs read as a binary number: rule 30 is 00011110<sub>2</sub>. The icon in the panel shows the table, from 111 on the left to 000 on the right.</p>
      <p>Time runs downward: each row is one generation, starting from generation zero at the top. Press play to keep going; the picture scrolls as new rows arrive.</p>
      <p>Rules behave in very different ways, from dying out (class 1) through repeating (class 2) and chaotic (class 3) to complex, with interacting structures (class 4). Swapping left and right, or 0 and 1, gives an equivalent rule, which leaves 88 fundamentally different ones.</p>
      <p>These automata are used in cryptography, random number generation and models of natural patterns.</p>`,
  });
})();
