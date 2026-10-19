/*
 * Conduit game rules — pure state, no DOM.
 *
 * A path is the list of cell indices for one color, starting at one of its dots.
 * While dragging, other colors' paths are recomputed from a snapshot taken at
 * drag start, so a pipe you cut comes back if you back off it again.
 */
(function (root) {
  "use strict";

  const Gen = typeof module !== "undefined" && module.exports ? require("./generator.js") : root.ConduitGen;

  class Game {
    constructor(puzzle) {
      this.p = puzzle;
      this.n = puzzle.w * puzzle.h;
      this.dot = new Map(); // cell -> color
      puzzle.pairs.forEach(([a, b], c) => { this.dot.set(a, c); this.dot.set(b, c); });
      this.paths = puzzle.pairs.map(() => []);
      this.active = null;
      this.snapshot = null;
      this.moves = 0;
      this.lastMoved = null;
      this.hints = 0;
      this.history = [];
    }

    get colors() { return this.p.pairs.length; }

    owner() {
      const o = new Array(this.n).fill(-1);
      this.paths.forEach((path, c) => path.forEach(cell => (o[cell] = c)));
      return o;
    }

    isComplete(c) {
      const path = this.paths[c], [a, b] = this.p.pairs[c];
      if (path.length < 2) return false;
      const s = path[0], e = path[path.length - 1];
      return (s === a && e === b) || (s === b && e === a);
    }

    flowsDone() { return this.paths.filter((_, c) => this.isComplete(c)).length; }

    pipePercent() {
      const o = this.owner();
      let filled = 0, total = 0;
      for (let i = 0; i < this.n; i++) {
        if (this.dot.has(i)) continue;
        total++;
        if (o[i] >= 0) filled++;
      }
      return total ? Math.round((filled / total) * 100) : 100;
    }

    isSolved() {
      if (this.flowsDone() !== this.colors) return false;
      return this.owner().every(c => c >= 0);
    }

    // ── drawing ──────────────────────────────────────────
    begin(cell) {
      if (this.isSolved()) return false;
      let c = this.dot.has(cell) ? this.dot.get(cell) : this.owner()[cell];
      if (c === undefined || c < 0) return false;
      this.snapshot = this.paths.map(p => p.slice());
      this.active = c;
      if (this.dot.has(cell)) {
        this.paths[c] = [cell];                     // restart from this dot
      } else {
        const at = this.paths[c].indexOf(cell);     // pick up the pipe mid-way
        this.paths[c] = this.paths[c].slice(0, at + 1);
      }
      this._reflow();
      return true;
    }

    // Move the drag to `cell`, stepping through intermediate cells if the
    // pointer skipped some. Returns true if anything changed.
    drag(cell) {
      if (this.active === null) return false;
      const w = this.p.w;
      let changed = false, guard = 0;
      while (guard++ < this.n) {
        const path = this.paths[this.active];
        const last = path[path.length - 1];
        if (last === cell) break;
        const lx = last % w, ly = (last / w) | 0, tx = cell % w, ty = (cell / w) | 0;
        const dx = tx - lx, dy = ty - ly;
        const next = Math.abs(dx) >= Math.abs(dy) ? last + Math.sign(dx) : last + Math.sign(dy) * w;
        if (!this._step(next)) break;
        changed = true;
      }
      return changed;
    }

    _step(cell) {
      const c = this.active, path = this.paths[c];
      const last = path[path.length - 1];
      if (!Gen.adjacent(last, cell, this.p.w)) return false;
      const back = path.indexOf(cell);
      if (back >= 0) {                              // backtrack over own pipe
        this.paths[c] = path.slice(0, back + 1);
        this._reflow();
        return true;
      }
      if (this.isComplete(c)) return false;         // already connected: only backtracking allowed
      if (this.dot.has(cell) && this.dot.get(cell) !== c) return false; // other color's dot
      path.push(cell);                              // own target dot, empty cell, or cut through a pipe
      this._reflow();
      return true;
    }

    // Other colors = their drag-start path, cut just before the first cell the
    // active pipe now occupies.
    _reflow() {
      const mine = new Set(this.paths[this.active]);
      this.snapshot.forEach((p, c) => {
        if (c === this.active) return;
        const cut = p.findIndex(cell => mine.has(cell));
        this.paths[c] = cut < 0 ? p.slice() : p.slice(0, cut);
      });
    }

    end() {
      if (this.active === null) return false;
      const changed = JSON.stringify(this.paths) !== JSON.stringify(this.snapshot);
      if (changed) {
        this.history.push({ paths: this.snapshot, moves: this.moves, lastMoved: this.lastMoved });
        if (this.lastMoved !== this.active) this.moves++;
        this.lastMoved = this.active;
      }
      this.active = null;
      this.snapshot = null;
      return changed;
    }

    undo() {
      const h = this.history.pop();
      if (!h) return false;
      this.paths = h.paths;
      this.moves = h.moves;
      this.lastMoved = h.lastMoved;
      return true;
    }

    reset() {
      if (this.paths.every(p => p.length === 0)) return false;
      this.history.push({ paths: this.paths.map(p => p.slice()), moves: this.moves, lastMoved: this.lastMoved });
      this.paths = this.p.pairs.map(() => []);
      this.lastMoved = null;
      return true;
    }

    // Lay one correct pipe from the solution, cutting whatever is in its way.
    hint() {
      const c = this.paths.findIndex((p, i) =>
        JSON.stringify(p) !== JSON.stringify(this.p.solution[i]) &&
        JSON.stringify(p.slice().reverse()) !== JSON.stringify(this.p.solution[i]));
      if (c < 0) return null;
      this.history.push({ paths: this.paths.map(p => p.slice()), moves: this.moves, lastMoved: this.lastMoved });
      this.snapshot = this.paths.map(p => p.slice());
      this.active = c;
      this.paths[c] = this.p.solution[c].slice();
      this._reflow();
      this.active = null;
      this.snapshot = null;
      this.hints++;
      return c;
    }
  }

  const api = { Game };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConduitGame = api;
})(this);
