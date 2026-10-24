// Shared helpers and the algorithm registry.
// Each algorithm file calls CA.register({...}); app.js builds the UI from the registry.
(function () {
  'use strict';

  const CA = (window.CA = window.CA || {});
  CA.algorithms = [];
  CA.register = (algo) => CA.algorithms.push(algo);

  // ---- Colors -------------------------------------------------------------
  // Canvas pixels are written as 32-bit values. Browsers are little-endian in
  // practice, so a pixel is stored as 0xAABBGGRR.
  CA.rgb = (r, g, b) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;

  CA.hex = function (hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return CA.rgb((n >> 16) & 255, (n >> 8) & 255, n & 255);
  };

  CA.hsl = function (h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return CA.rgb(Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255));
  };

  CA.mix = function (c1, c2, t) {
    const ch = (c, s) => (c >>> s) & 255;
    const m = (s) => Math.round(ch(c1, s) + (ch(c2, s) - ch(c1, s)) * t);
    return CA.rgb(m(0), m(8), m(16));
  };

  // Build a lookup table of `size` colors by interpolating between hex stops.
  CA.gradient = function (stops, size) {
    const cols = stops.map((s) => (typeof s === 'number' ? s : CA.hex(s)));
    const lut = new Uint32Array(size);
    for (let i = 0; i < size; i++) {
      const t = (i / (size - 1)) * (cols.length - 1);
      const j = Math.min(Math.floor(t), cols.length - 2);
      lut[i] = CA.mix(cols[j], cols[j + 1], t - j);
    }
    return lut;
  };

  // Evenly spaced hues, used by multi-state automata.
  CA.rainbow = function (n, offset = 0, s = 72, l = 56) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(CA.hsl((offset + (360 * i) / n) % 360, s, l));
    return out;
  };

  // ---- Misc ---------------------------------------------------------------
  CA.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  CA.randInt = (n) => Math.floor(Math.random() * n);
  CA.fmt = (n) => Math.round(n).toLocaleString('en-US');
  CA.pct = (x) => (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%';

  // ---- 1D history ---------------------------------------------------------
  // A ring buffer of rows. New generations are pushed at the bottom and the
  // oldest row scrolls off the top once the screen is full.
  CA.Strip = class {
    constructor(cols, rows) {
      this.cols = cols;
      this.rows = rows;
      this.buf = new Uint8Array(cols * rows);
      this.start = 0;
      this.count = 0;
    }
    push(row) {
      let r;
      if (this.count < this.rows) {
        r = (this.start + this.count) % this.rows;
        this.count++;
      } else {
        r = this.start;
        this.start = (this.start + 1) % this.rows;
      }
      this.buf.set(row, r * this.cols);
    }
    // Offset into buf of the screen row `y` (0 = top), or -1 if not filled yet.
    rowOffset(y) {
      return y < this.count ? ((this.start + y) % this.rows) * this.cols : -1;
    }
    render(out, palette) {
      const { cols, rows, buf } = this;
      for (let y = 0; y < rows; y++) {
        const src = this.rowOffset(y);
        const dst = y * cols;
        if (src < 0) {
          out.fill(palette[0], dst, dst + cols);
          continue;
        }
        for (let x = 0; x < cols; x++) out[dst + x] = palette[buf[src + x]];
      }
    }
  };

  // Seed a 1D row. `start` is one of: single, random, sparse.
  CA.seedRow = function (row, start, states = 2) {
    row.fill(0);
    if (start === 'random') {
      for (let i = 0; i < row.length; i++) row[i] = CA.randInt(states);
    } else if (start === 'sparse') {
      for (let i = 0; i < row.length; i++) row[i] = Math.random() < 0.08 ? 1 + CA.randInt(states - 1) : 0;
    } else {
      row[row.length >> 1] = states - 1;
    }
  };

  CA.startOptions = [
    { value: 'single', label: 'Single cell' },
    { value: 'random', label: 'Random' },
    { value: 'sparse', label: 'Sparse random' },
  ];

  // ---- 2D helpers ---------------------------------------------------------
  // Parse a Life-style RLE pattern ("bo$2bo$3o!") into a list of [x, y] cells.
  CA.parseRLE = function (rle) {
    const cells = [];
    let x = 0, y = 0, num = '';
    for (const ch of rle.replace(/\s+/g, '')) {
      if (ch >= '0' && ch <= '9') { num += ch; continue; }
      const n = num ? parseInt(num, 10) : 1;
      num = '';
      if (ch === 'b' || ch === '.') x += n;
      else if (ch === 'o' || ch === 'A') { for (let i = 0; i < n; i++) cells.push([x++, y]); }
      else if (ch === '$') { y += n; x = 0; }
      else if (ch === '!') break;
    }
    return cells;
  };

  // Stamp a pattern centred on (cx, cy) into a grid, wrapping at the edges.
  CA.stamp = function (grid, cols, rows, cells, value = 1, cx = cols >> 1, cy = rows >> 1) {
    let w = 0, h = 0;
    for (const [x, y] of cells) { w = Math.max(w, x + 1); h = Math.max(h, y + 1); }
    const ox = cx - (w >> 1), oy = cy - (h >> 1);
    for (const [x, y] of cells) {
      const gx = (((ox + x) % cols) + cols) % cols;
      const gy = (((oy + y) % rows) + rows) % rows;
      grid[gy * cols + gx] = value;
    }
  };

  // Escape text for safe insertion into HTML.
  CA.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
})();
