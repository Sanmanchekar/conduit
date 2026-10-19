# Conduit

Connect each pair of matching dots with a pipe. Pipes can't cross, and a puzzle is only solved when **every cell is filled**.

**▶ Play: https://sanmanchekar.github.io/conduit/**

360 levels across six grid sizes (5×5 to 10×10). Runs in any modern browser on desktop and phone, with no install, account or tracking.

## How to play

| Do | How |
|---|---|
| Draw a pipe | Drag from a dot. Drag to its twin to connect them |
| Back up | Drag back along your own pipe |
| Reroute | Start from a dot again to redraw that color, or grab a pipe mid-way to continue from there |
| Cut through | Drawing over another color cuts it. Back off in the same drag and it comes back |
| Undo · Reset · Hint | Buttons, or `U` / `Ctrl+Z` · `R` · `H` |
| Next · previous level | `N` · `P`, or the arrows |

**Moves** count each time you switch to drawing a different color. Solve a level in exactly one move per color, with no hints, for a ★.

Turn on **Letters on dots** if colors are hard to tell apart.

## How the levels are made

Every level is generated from its own solution, so every level is solvable with the whole grid filled:

1. Draw a random path that visits every cell once. It starts as a zig-zag and is scrambled with thousands of "backbite" moves.
2. Cut that path into one segment per color, each at least 3 cells long.
3. The two ends of each segment become that color's dots.

Layouts where a pair's dots touch, or where more than one pipe is a straight line, are thrown away and regenerated. Generation is seeded by size and level number, so level 7-12 is the same puzzle for everyone. Any valid fill counts as a solve, not just the generator's.

Progress is saved in your browser (`localStorage`). Clearing site data resets it.

## Run locally

No build step and no dependencies:

```bash
git clone https://github.com/Sanmanchekar/conduit.git
cd conduit
open index.html            # or: npm start, then visit http://localhost:8000
npm test                   # generator + rules tests (Node 18+)
```

## Code

| File | What it does |
|---|---|
| `src/generator.js` | Seeded random puzzle generation |
| `src/game.js` | Rules: drawing, backtracking, cutting, undo, hints, win check. No DOM |
| `src/render.js` | Canvas drawing |
| `src/main.js` | Input, level flow, saved progress |
| `test/run.js` | Checks all 360 levels fill the grid, and solves 120 of them through the drawing code |

## License

[MIT](LICENSE)
