# The Experiment Lab

An interactive, replayable game that teaches experimental design and statistics. Players run a lemonade-stand experiment lab, make decisions with incomplete information, see the consequences, and unlock better experimental tools.

Built as a static HTML/JavaScript site — no build step, no framework. Hosted on Cloudflare via Wrangler; run everything with Bun.

## What it is

The site transforms statistics education from "read → view chart → click → continue" into "decide → predict → simulate → inspect → understand → unlock." Players progress through a campaign of short missions, each teaching one experimental method through a concrete, low-stakes interaction.

## Campaign structure

| District | Concept focus |
| --- | --- |
| First Experiments | Randomization, control/treatment, effect size |
| Clearer Evidence | CUPED, variance reduction, A/A tests |
| Data Traps | Signal vs. noise, peeking, multiple testing |
| Smarter Decisions | Switchbacks, bandits, Bayesian updating, holdout groups |
| Final Lab | Apply every unlocked tool end-to-end |

## Player systems

- **Campaign map** — districts and missions with locked/available/complete states
- **Lab notebook** — unlocked concept cards (method, purpose, when to use, warning)
- **Toolbelt** — earned methods become capabilities used in later missions
- **Progress persistence** — localStorage; resumes on refresh
- **Free Lab** — sandbox unlocked after campaign completion
- **Replay** — replay any mission, optionally with a new random seed

## Tech stack

- Static HTML + vanilla JavaScript (no build step)
- Canvas 2D for all simulations and visualizations
- `engine.js` — math helpers, canvas drawing primitives, scene manager
- `app/` — campaign shell (HUD, map, notebook, mission lifecycle, progress, accessibility)
- `chapters/` — per-mission simulation modules that register scenes

## Development & deployment

| Command | Effect |
| --- | --- |
| `bun install` | Install dev dependencies (Wrangler) — one-time |
| `bun dev` | Local dev server (Wrangler) on http://localhost:8787 |
| `bun run deploy` | Deploy to Cloudflare |
| `bun run preview` | Upload a preview version without deploying |

The GitHub repo is connected to Cloudflare; `bun run deploy` publishes the static assets via Wrangler.

## Accessibility

- All essential actions are keyboard-operable HTML controls
- Canvas interactions have text alternatives via paired controls
- Focus states always visible
- Color is never the only group indicator
- Motion honors `prefers-reduced-motion`
- Completion never depends on speed, pointer precision, or predicting correctly