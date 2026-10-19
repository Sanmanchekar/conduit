// Run with: node test/run.js
"use strict";
const assert = require("assert");
const { generate, adjacent, MIN_LEN } = require("../src/generator.js");
const { Game } = require("../src/game.js");

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error("✗ " + name + "\n  " + e.message); process.exitCode = 1; }
}

const SIZES = [5, 6, 7, 8, 9, 10];
const LEVELS = 60;

test("every level is solvable with every cell filled", () => {
  for (const size of SIZES) {
    for (let level = 1; level <= LEVELS; level++) {
      const p = generate(size, level);
      const seen = new Set();
      p.solution.forEach((seg, c) => {
        assert.ok(seg.length >= MIN_LEN, `${size}/${level} color ${c} too short`);
        assert.deepStrictEqual([seg[0], seg[seg.length - 1]], p.pairs[c]);
        assert.ok(!adjacent(seg[0], seg[seg.length - 1], p.w), `${size}/${level} color ${c} dots touch`);
        seg.forEach((cell, i) => {
          assert.ok(!seen.has(cell), `${size}/${level} cell ${cell} used twice`);
          seen.add(cell);
          if (i) assert.ok(adjacent(seg[i - 1], cell, p.w), `${size}/${level} color ${c} jumps`);
        });
      });
      assert.strictEqual(seen.size, size * size, `${size}/${level} does not cover the grid`);
    }
  }
});

test("levels are deterministic", () => {
  assert.deepStrictEqual(generate(7, 12), generate(7, 12));
  assert.notDeepStrictEqual(generate(7, 12).pairs, generate(7, 13).pairs);
});

test("drawing the solution through the drag API solves every level", () => {
  for (const size of SIZES) {
    for (let level = 1; level <= 20; level++) {
      const p = generate(size, level);
      const g = new Game(p);
      p.solution.forEach(seg => {
        assert.ok(g.begin(seg[0]));
        for (const cell of seg.slice(1)) g.drag(cell);
        g.end();
      });
      assert.ok(g.isSolved(), `${size}/${level} not solved`);
      assert.strictEqual(g.moves, p.pairs.length, "perfect solve = one move per color");
      assert.strictEqual(g.pipePercent(), 100);
    }
  }
});

test("dragging to the far end in one jump steps through cells", () => {
  const p = generate(5, 1);
  const g = new Game(p);
  const seg = p.solution[0];
  g.begin(seg[0]);
  seg.slice(1).forEach(c => g.drag(c));
  assert.ok(g.isComplete(0));
});

test("cannot draw onto another color's dot", () => {
  const p = generate(6, 3);
  const g = new Game(p);
  const [a] = p.pairs[0];
  const other = [].concat(...p.pairs.slice(1)).find(d => adjacent(d, a, p.w));
  if (other === undefined) return; // no neighbouring dot in this layout
  g.begin(a);
  assert.ok(!g.drag(other));
  assert.deepStrictEqual(g.paths[0], [a]);
});

test("cutting a pipe restores it when you back off", () => {
  // Hand-built 3x3: color 0 runs along the top row, color 1 down the middle column.
  const p = { w: 3, h: 3, pairs: [[0, 2], [7, 4]], solution: [[0, 1, 2], [7, 4]] };
  const g = new Game(p);
  g.begin(0); g.drag(1); g.drag(2); g.end();
  assert.ok(g.isComplete(0));
  g.begin(7); g.drag(4);                     // 4 is color 1's own dot → completes
  g.end();
  g.begin(4);                                // restart color 1 from dot 4
  g.drag(1);                                 // cuts color 0 at cell 1
  assert.deepStrictEqual(g.paths[0], [0]);
  g.drag(4);                                 // back off
  assert.deepStrictEqual(g.paths[0], [0, 1, 2], "cut pipe comes back during the same drag");
  g.end();
});

test("backtracking shortens the active pipe", () => {
  const p = generate(5, 2);
  const g = new Game(p);
  const seg = p.solution[1];
  g.begin(seg[0]); g.drag(seg[1]); g.drag(seg[2]); g.drag(seg[1]);
  assert.deepStrictEqual(g.paths[1], [seg[0], seg[1]]);
});

test("undo, reset and hint", () => {
  const p = generate(6, 4);
  const g = new Game(p);
  const seg = p.solution[0];
  g.begin(seg[0]); seg.slice(1).forEach(c => g.drag(c)); g.end();
  assert.ok(g.isComplete(0));
  g.undo();
  assert.deepStrictEqual(g.paths[0], []);
  const c = g.hint();
  assert.ok(g.isComplete(c));
  assert.strictEqual(g.hints, 1);
  g.reset();
  assert.ok(g.paths.every(x => x.length === 0));
  g.undo();
  assert.ok(g.isComplete(c), "undo restores the board before reset");
  for (let i = 0; i < p.pairs.length; i++) g.hint();
  assert.ok(g.isSolved(), "hints alone can finish the level");
});

console.log(`${passed} test groups passed${process.exitCode ? " (with failures)" : ""}`);
