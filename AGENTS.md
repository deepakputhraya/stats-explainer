# Agent Guide — The Experiment Lab

## Project overview

A static HTML/JS educational game teaching experimental design through an interactive campaign. No framework, no build step — the source files are served as-is. Hosted on Cloudflare via Wrangler (static assets); run everything with Bun. Local dev: `bun dev` (wrangler dev) → http://localhost:8787.

## Architecture

```
engine.js              # Math helpers, canvas drawing primitives, scene manager, boot
index.html             # All HTML + CSS (theme, layout, overlays, surface)
app/
  ui.js                # DOM building blocks (el, button, card, callout)
  accessibility.js     # Focus, live region, reduced-motion detection
  progress.js          # localStorage persistence (completed, unlocked, predictions)
  campaign.js          # Districts, missions, tool catalog, gating logic
  scene-objects.js     # Recurring canvas props (cups, signs, clipboards, customers)
  hud.js               # Sticky top bar (Map/Notebook/Settings/Free Lab)
  map.js               # Campaign map overlay
  notebook.js          # Unlocked concept cards overlay
  challenge.js         # Optional challenge wrapper
  mission-shell.js     # Briefing → prediction → action → debrief → unlock lifecycle
  freelab.js           # Post-campaign sandbox
chapters/
  00-what-is-an-experiment.js   # Test the New Recipe (randomization)
  01-cuped.js                    # Use Customer History (CUPED)
  02-variance-reduction.js      # Make Data Clearer (stratification, control variates)
  03-signal-vs-noise.js         # Is the Gap Real? (permutation test)
  04-peeking.js                 # Resist the Live Dashboard (stopping rules)
  05-multiple-testing.js        # Release Triage (Benjamini-Hochberg)
  06-aa-tests.js                # Inspect the Machinery (A/A tests, SRM)
  07-switchback.js              # Test a Shared System (switchbacks)
  08-bandits.js                 # Learn While Earning (multi-armed bandits)
  09-bayesian.js                # Update Beliefs (Bayesian updating)
  10-holdout.js                 # Keep a Holdout (holdout groups)
  final-lab.js                  # The Final Lab (capstone experiment designer)
assets/
  fonts/FuturaHandwritten.ttf   # Handwritten font (from ncase/trust)
  ui/button.png                  # Hand-drawn button sprite (3 states)
  favicon.png                    # Lemon favicon
```

## Key patterns

### Scene registration

Each chapter file calls `registerChapter(id, { scenes: [...] })` at the end. Scenes are objects with `title`, `text(state)`, `enter(state)`, `draw(ctx, now, state)`, and optionally `legend(state)`. The engine drives the scene loop; chapters own their simulation logic and canvas rendering.

### Campaign metadata

`app/campaign.js` defines `MISSIONS` (structured metadata: id, district, title, objective, prerequisites, unlocks, briefing, prediction, debrief, notebookEntry, chapterId) and `TOOLS` (unlockable methods with purpose/when/warning). The mission shell wraps each chapter's scenes with briefing → prediction → action → debrief → unlock.

### State persistence

`app/progress.js` stores a single JSON object in `localStorage` under `exlab.progress`. Shape: `{ version, completedMissionIds, unlockedToolIds, completedChallengeIds, predictions, currentMissionId, reducedMotionOverride }`.

### Canvas rendering

All canvas drawing uses the engine's `COLOR` palette and `ctx` global. Chapters define local `label()` helpers that call `ctx.fillText()`. Font is `FuturaHandwritten, cursive` everywhere.

### Deep-linking

URL hash format: `#mission=<missionId>&scene=<sceneIndex>`. The engine resumes mid-mission by initializing the shell's active mission then jumping to the scene.

## Engine globals available to chapters

- `ctx` — canvas 2D context (already scaled for DPI)
- `COLOR` — palette object (control, treatment, ink, muted, good, warn, line, accent, gold, pink, purple)
- `PALETTE` / `colorAt(i)` — qualitative palette for multi-group chapters
- `LOGICAL_W` / `LOGICAL_H` — canvas logical dimensions (880×480)
- `clearStage()` — clear canvas
- Drawing primitives: `drawUnitGrid`, `drawMorphBars`, `drawScatter`, `drawSpreadMeter`
- Math: `mulberry32`, `randNormal`, `shuffle`, `lerp`, `clamp`, `easeOutCubic`, `easeInOutCubic`, `stdev`, `mean`, `motionDuration`
- UI: `makeBtn`, `makeNote`, `setLegend`, `controlsEl`, `updateText`
- `registerChapter(id, { scenes })`

## Color palette

| Token | Hex | Use |
| --- | --- | --- |
| `COLOR.control` | `#4089DD` | Control group (blue) |
| `COLOR.treatment` | `#e8902c` | Treatment group (orange) |
| `COLOR.accent` | `#52537F` | Highlights, trend lines, chance dots (purple) |
| `COLOR.good` | `#86C448` | Positive results (green) |
| `COLOR.warn` | `#FF5E5E` | Warnings, false positives (red) |
| `COLOR.ink` | `#333333` | Primary text |
| `COLOR.muted` | `#666666` | Secondary text |
| `COLOR.line` | `#bbbbbb` | Axis lines, borders |

## Local development

The project uses Wrangler (installed as a dev dependency via Bun) to serve and deploy the static site on Cloudflare. No worker script — `wrangler.jsonc` configures static assets only, with `./` as the assets directory and SPA fallback. `.assetsignore` excludes `node_modules/`, `.wrangler/`, and non-asset files from the deploy bundle.

```bash
bun install          # one-time: installs wrangler dev dependency
bun dev              # local dev server (wrangler dev) on http://localhost:8787
bun run deploy       # deploy to Cloudflare (requires cf auth)
bun run preview      # upload a preview version without deploying
```

## Testing

No test framework. Verification is done via jsdom + node-canvas smoke tests that load the inlined HTML, boot the campaign, and walk through mission lifecycles checking for console errors.

```bash
# Install test deps (one-time)
cd /tmp && bun install jsdom canvas

# Run a smoke test (write a script that loads index.html via jsdom)
bun -e "..."
```

## Adding a new mission

1. Create `chapters/<id>.js` with an IIFE that registers scenes via `registerChapter("<id>", { scenes: [...] })`
2. Add the mission to `MISSIONS` in `app/campaign.js` with metadata (district, prerequisites, unlocks, briefing, prediction, debrief, notebookEntry, chapterId)
3. Add any new tool to `TOOLS` in `app/campaign.js`
4. Add `<script src="chapters/<id>.js"></script>` to `index.html` before the boot script

## Conventions

- `"use strict"` at top of every file
- IIFE pattern for chapters and app modules: `(function(global){ ... })(window)`
- App modules expose one global: `UI`, `A11y`, `Progress`, `Campaign`, `HUD`, `Map`, `Notebook`, `Challenge`, `MissionShell`, `FreeLab`, `Props`
- Engine exposes `window.CHAPTERS`, `window.COLOR`, `window.ctx`, `window.Engine`
- Top-level `const` in engine.js does NOT attach to `window` — it's explicitly exposed where app modules need it
- Wrangler + Bun for dev/deploy (dev dependency, no global install needed)
- No build step; source files served as-is