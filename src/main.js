/* Conduit — UI wiring: input, level flow, saved progress. */
(function () {
  "use strict";
  const { generate } = window.ConduitGen;
  const { Game } = window.ConduitGame;
  const { draw, PALETTE } = window.ConduitRender;

  const SIZES = [5, 6, 7, 8, 9, 10];
  const LEVELS = 60;
  const KEY = "conduit.v1";
  const $ = id => document.getElementById(id);

  // ── saved progress (per browser; the game works without it) ──
  const store = (() => {
    let data = { at: { size: 5, level: 1 }, solved: {}, letters: false };
    try { const raw = localStorage.getItem(KEY); if (raw) data = Object.assign(data, JSON.parse(raw)); } catch (e) { /* private mode */ }
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } };
    return {
      get at() { return data.at; },
      set at(v) { data.at = v; save(); },
      get letters() { return data.letters; },
      set letters(v) { data.letters = v; save(); },
      result(size, level) { return data.solved[size + ":" + level]; },
      record(size, level, moves, perfect) {
        const k = size + ":" + level, prev = data.solved[k];
        if (!prev || moves < prev.moves) data.solved[k] = { moves, perfect: perfect || (prev && prev.perfect) || false };
        save();
      },
      count(size) { return Object.keys(data.solved).filter(k => k.startsWith(size + ":")).length; },
    };
  })();

  // ── state ──
  let size = store.at.size, level = store.at.level;
  let game, cell = 60, dpr = 1, pointer = null, pulse = 0;
  const canvas = $("board"), ctx = canvas.getContext("2d");

  function load(s, l) {
    size = Math.min(10, Math.max(5, s));
    level = ((l - 1 + LEVELS) % LEVELS) + 1;
    store.at = { size, level };
    game = new Game(generate(size, level));
    layout();
    update();
  }

  function layout() {
    const wrap = $("board-wrap");
    const avail = Math.min(wrap.clientWidth || 560, window.innerHeight - 300, 560);
    cell = Math.max(28, Math.floor(Math.max(avail, 260) / size));
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const px = cell * size;
    canvas.style.width = px + "px";
    canvas.style.height = px + "px";
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    render();
  }

  function render() {
    draw(ctx, game, { cell, dpr, pointer, letters: store.letters, pulse });
  }

  function update() {
    $("level-label").textContent = `${size}×${size} · Level ${level}`;
    $("s-flows").textContent = `${game.flowsDone()}/${game.colors}`;
    $("s-moves").textContent = game.moves;
    const r = store.result(size, level);
    $("s-best").textContent = r ? r.moves + (r.perfect ? " ★" : "") : "—";
    $("s-pipe").textContent = game.pipePercent() + "%";
    $("b-undo").disabled = game.history.length === 0;
    render();
  }

  // ── input ──
  function cellAt(ev) {
    const r = canvas.getBoundingClientRect();
    const x = ev.clientX - r.left, y = ev.clientY - r.top;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    return { x, y, idx: cx >= 0 && cy >= 0 && cx < size && cy < size ? cy * size + cx : -1 };
  }

  canvas.addEventListener("pointerdown", ev => {
    const { x, y, idx } = cellAt(ev);
    if (idx < 0 || !game.begin(idx)) return;
    canvas.setPointerCapture(ev.pointerId);
    pointer = [x, y];
    ev.preventDefault();
    update();
  });
  canvas.addEventListener("pointermove", ev => {
    if (game.active === null) return;
    const { x, y, idx } = cellAt(ev);
    pointer = [x, y];
    if (idx >= 0) game.drag(idx);
    update();
  });
  const finish = () => {
    if (game.active === null) return;
    game.end();
    pointer = null;
    update();
    if (game.isSolved()) onSolved();
  };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);

  // ── win ──
  function onSolved() {
    const perfect = game.moves === game.colors && game.hints === 0;
    store.record(size, level, game.moves, perfect);
    update();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = () => {
      $("win-title").textContent = perfect ? "Perfect" : "Solved";
      $("win-text").textContent =
        `${game.moves} move${game.moves === 1 ? "" : "s"} · perfect is ${game.colors}` +
        (game.hints ? ` · ${game.hints} hint${game.hints === 1 ? "" : "s"} used` : "");
      $("win").showModal();
      $("w-next").focus();
    };
    if (reduce) return show();
    const t0 = performance.now();
    (function tick(t) {
      pulse = Math.min(1, (t - t0) / 600);
      render();
      if (pulse < 1) requestAnimationFrame(tick); else { pulse = 0; render(); show(); }
    })(t0);
  }
  // Buttons act directly; form method="dialog" closes the dialog after the click.
  $("w-next").addEventListener("click", () => nextLevel());
  $("w-replay").addEventListener("click", () => load(size, level));

  function nextLevel() {
    if (level < LEVELS) load(size, level + 1);
    else if (size < 10) load(size + 1, 1);
    else load(size, 1);
  }
  function prevLevel() {
    if (level > 1) load(size, level - 1);
    else if (size > 5) load(size - 1, LEVELS);
  }

  // ── controls ──
  $("b-next").addEventListener("click", nextLevel);
  $("b-prev").addEventListener("click", prevLevel);
  $("b-undo").addEventListener("click", () => { if (game.undo()) update(); });
  $("b-reset").addEventListener("click", () => { if (game.reset()) update(); });
  $("b-hint").addEventListener("click", () => {
    if (game.hint() !== null) { update(); if (game.isSolved()) onSolved(); }
  });
  $("opt-letters").checked = store.letters;
  $("opt-letters").addEventListener("change", e => { store.letters = e.target.checked; render(); });

  document.addEventListener("keydown", ev => {
    if (document.querySelector("dialog[open]")) return;
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === "z") { ev.preventDefault(); $("b-undo").click(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (k === "u") $("b-undo").click();
    else if (k === "r") $("b-reset").click();
    else if (k === "h") $("b-hint").click();
    else if (k === "n") nextLevel();
    else if (k === "p") prevLevel();
  });

  // ── level picker ──
  let pickSize = size;
  function renderPicker() {
    const tabs = $("size-tabs");
    tabs.innerHTML = "";
    SIZES.forEach(s => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "tab"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(s === pickSize));
      b.textContent = `${s}×${s}`;
      b.addEventListener("click", () => { pickSize = s; renderPicker(); });
      tabs.appendChild(b);
    });
    $("size-progress").textContent = `${store.count(pickSize)} of ${LEVELS} solved · ★ = solved in the fewest moves without hints`;
    const grid = $("level-grid");
    grid.innerHTML = "";
    for (let l = 1; l <= LEVELS; l++) {
      const r = store.result(pickSize, l);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "lv" + (r ? " done" : "") + (r && r.perfect ? " perfect" : "") + (pickSize === size && l === level ? " current" : "");
      b.style.setProperty("--c", PALETTE[(l - 1) % PALETTE.length]);
      b.textContent = l;
      b.setAttribute("aria-label", `Level ${l}` + (r ? (r.perfect ? ", perfect" : ", solved") : ""));
      b.addEventListener("click", () => { $("levels").close(); load(pickSize, l); });
      grid.appendChild(b);
    }
  }
  $("open-levels").addEventListener("click", () => { pickSize = size; renderPicker(); $("levels").showModal(); });

  window.addEventListener("resize", layout);
  load(size, level);
})();
