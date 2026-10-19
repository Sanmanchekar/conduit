/*
 * Conduit puzzle generator.
 *
 * Every puzzle is built from its own solution, so it is always solvable with
 * every cell filled:
 *   1. Make a random Hamiltonian path through the grid (a serpentine path,
 *      shuffled with thousands of "backbite" moves).
 *   2. Cut that path into segments of at least MIN_LEN cells.
 *   3. Each segment becomes one color; its two ends become the dots.
 * Puzzles where a pair's dots touch, or a segment is a straight line, are
 * rejected and regenerated — they are trivial to solve.
 *
 * Seeded, so level N of size S is the same puzzle on every device.
 */
(function (root) {
  "use strict";

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFor(size, level) {
    // FNV-1a over "size:level" — stable across JS engines.
    const s = size + ":" + level;
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h;
  }

  function neighbors(idx, w, h) {
    const x = idx % w, y = (idx / w) | 0, out = [];
    if (x > 0) out.push(idx - 1);
    if (x < w - 1) out.push(idx + 1);
    if (y > 0) out.push(idx - w);
    if (y < h - 1) out.push(idx + w);
    return out;
  }

  function serpentine(w, h) {
    const p = [];
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < w; i++) p.push(y * w + (y % 2 === 0 ? i : w - 1 - i));
    }
    return p;
  }

  // One backbite move at the tail: pick a grid neighbour x of the tail (not the
  // cell just before it); reverse everything after x so x's old successor
  // becomes the new tail. The result is still a Hamiltonian path.
  function backbite(path, pos, w, h, rnd) {
    const L = path.length;
    const tail = path[L - 1];
    const opts = neighbors(tail, w, h).filter(n => n !== path[L - 2]);
    const x = opts[(rnd() * opts.length) | 0];
    const i = pos[x];
    for (let a = i + 1, b = L - 1; a < b; a++, b--) {
      const t = path[a]; path[a] = path[b]; path[b] = t;
      pos[path[a]] = a; pos[path[b]] = b;
    }
  }

  function randomHamiltonian(w, h, rnd) {
    const path = serpentine(w, h);
    const pos = new Array(w * h);
    path.forEach((c, i) => (pos[c] = i));
    const iters = w * h * 40;
    for (let k = 0; k < iters; k++) {
      if (rnd() < 0.5) {
        path.reverse();
        path.forEach((c, i) => (pos[c] = i));
      }
      backbite(path, pos, w, h, rnd);
    }
    return path;
  }

  const MIN_LEN = 3;

  function cut(path, colors, rnd) {
    // Choose segment lengths ≥ MIN_LEN that sum to path.length, roughly even
    // with some jitter so flows have different lengths.
    const L = path.length;
    const lens = new Array(colors).fill(MIN_LEN);
    let spare = L - MIN_LEN * colors;
    while (spare > 0) {
      lens[(rnd() * colors) | 0]++;
      spare--;
    }
    const segs = [];
    let at = 0;
    for (const n of lens) {
      segs.push(path.slice(at, at + n));
      at += n;
    }
    return segs;
  }

  function adjacent(a, b, w) {
    const ax = a % w, ay = (a / w) | 0, bx = b % w, by = (b / w) | 0;
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  function straight(seg, w) {
    const xs = new Set(seg.map(c => c % w)), ys = new Set(seg.map(c => (c / w) | 0));
    return xs.size === 1 || ys.size === 1;
  }

  // Colors per size: enough flows to be interesting, few enough to fit a palette.
  function colorCount(size, rnd) {
    const base = { 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10 }[size] || size;
    return Math.max(3, base - (rnd() < 0.5 ? 1 : 0));
  }

  function generate(size, level) {
    const w = size, h = size;
    const rnd = mulberry32(seedFor(size, level));
    for (let attempt = 0; attempt < 400; attempt++) {
      const colors = colorCount(size, rnd);
      const segs = cut(randomHamiltonian(w, h, rnd), colors, rnd);
      const ok = segs.every(s => !adjacent(s[0], s[s.length - 1], w)) &&
                 segs.filter(s => straight(s, w)).length <= 1;
      if (!ok) continue;
      // Shuffle color order so color 0 is not always the path start.
      for (let i = segs.length - 1; i > 0; i--) {
        const j = (rnd() * (i + 1)) | 0;
        const t = segs[i]; segs[i] = segs[j]; segs[j] = t;
      }
      return {
        size, level, w, h,
        pairs: segs.map(s => [s[0], s[s.length - 1]]),
        solution: segs,
      };
    }
    throw new Error(`could not generate ${size}x${size} level ${level}`);
  }

  const api = { generate, mulberry32, seedFor, neighbors, adjacent, MIN_LEN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConduitGen = api;
})(this);
