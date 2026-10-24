# Cellular Automata

Interactive cellular automata that run entirely in the browser: no server, no build step.

**Live site:** https://dec3ptor.github.io/RULE_30/

## Algorithms

**1D**
- **Elementary**: all 256 rules (Rule 30, 90, 110, …). Type a number or an 8-bit binary rule. Shows the rule table, equivalent rules (mirror and complement) and Rule 30's centre column.
- **Rule comparison**: runs two rules side by side and colours the cells where they differ, with an optional mirror for either rule.
- **Totalistic (3 colours)**: Wolfram's 2,187 three-colour totalistic rules, e.g. code 1599.

**2D**
- **Game of Life**: Conway's Life plus HighLife, Seeds, Day & Night, Maze and other B/S rules, and "Generations" rules like Brian's Brain and Star Wars. Includes the glider gun, R-pentomino and other starting patterns.
- **Langton's ant**: the classic ant and multi-colour turmites (RLR, LLRR, …), with more than one ant if you like.
- **Cyclic**: spiral-forming cyclic automata with adjustable range, threshold and neighbourhood.
- **Reaction–diffusion**: the Gray–Scott model (coral, mitosis, worms, spots, …).
- **Sandpile**: the Abelian sandpile and its fractal.
- **Forest fire**: the Drossel–Schwabl model.

Every view has play/pause, single-step, speed and cell-size controls, PNG export, and a **Link** button that copies a URL with the current settings. On 2D views, turn on **Draw** to edit the grid.

## Running locally

Open `index.html` in a browser. That's it.

## Deploying

`.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`. In the repository's **Settings → Pages**, **Source** must be set to **GitHub Actions**.

## Adding an algorithm

Create a file in `js/algos/` that calls `CA.register({...})` (see `forest.js` for a short example) and add a `<script>` tag for it in `index.html`. The app builds the controls from the `params` list and calls the simulation's `step()` and `render()` methods.
