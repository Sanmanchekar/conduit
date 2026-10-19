/* Conduit canvas renderer. Draws one frame from game state; holds no state itself. */
(function (root) {
  "use strict";

  // Twelve pipe colors chosen to stay distinct from each other on the dark ground.
  const PALETTE = [
    "#ff3b3b", "#2f6bff", "#22b04b", "#f2d500", "#ff8a1f", "#22d3ee",
    "#e83ad6", "#a52a3a", "#8b5cf6", "#f1f1f1", "#9aa3b2", "#a3e635",
  ];
  const GROUND = "#161925", GRID = "#2a2e3e";

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function draw(ctx, game, view) {
    const { w, h } = game.p;
    const { cell, dpr, pointer, letters, pulse } = view;
    const W = w * cell, H = h * cell;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = GROUND;
    ctx.fillRect(0, 0, W, H);

    const owner = game.owner();
    const center = i => [(i % w + 0.5) * cell, (((i / w) | 0) + 0.5) * cell];

    // Cell tints under pipes.
    for (let i = 0; i < owner.length; i++) {
      if (owner[i] < 0) continue;
      const done = game.isComplete(owner[i]);
      ctx.fillStyle = hexA(PALETTE[owner[i] % PALETTE.length], done ? 0.22 : 0.12);
      ctx.fillRect((i % w) * cell, ((i / w) | 0) * cell, cell, cell);
    }

    // Grid.
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, H); }
    for (let y = 0; y <= h; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(W, y * cell + 0.5); }
    ctx.stroke();

    // Pipes.
    const glow = pulse > 0 ? Math.sin(pulse * Math.PI) : 0;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    game.paths.forEach((path, c) => {
      if (path.length < 2) return;
      const col = PALETTE[c % PALETTE.length];
      ctx.strokeStyle = col;
      ctx.lineWidth = cell * (0.34 + 0.06 * glow);
      ctx.beginPath();
      path.forEach((i, k) => { const [x, y] = center(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    });

    // Dots.
    game.p.pairs.forEach((pair, c) => {
      const col = PALETTE[c % PALETTE.length];
      const done = game.isComplete(c);
      pair.forEach(i => {
        const [x, y] = center(i);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, cell * 0.33, 0, Math.PI * 2); ctx.fill();
        if (done) {
          ctx.strokeStyle = hexA("#ffffff", 0.55);
          ctx.lineWidth = Math.max(1.5, cell * 0.04);
          ctx.beginPath(); ctx.arc(x, y, cell * 0.33 - ctx.lineWidth, 0, Math.PI * 2); ctx.stroke();
        }
        if (letters) {
          ctx.fillStyle = c === 9 || c === 3 || c === 11 ? "#111" : "#fff";
          ctx.font = `700 ${Math.round(cell * 0.3)}px Figtree, system-ui, sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(String.fromCharCode(65 + c), x, y + 1);
        }
      });
    });

    // Finger halo while drawing, so the pipe end is visible under a thumb.
    if (pointer && game.active !== null) {
      ctx.fillStyle = hexA(PALETTE[game.active % PALETTE.length], 0.25);
      ctx.beginPath(); ctx.arc(pointer[0], pointer[1], cell * 0.9, 0, Math.PI * 2); ctx.fill();
    }
  }

  const api = { draw, PALETTE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ConduitRender = api;
})(this);
