# Prototype 0.2 focused production QA

## Scope and command

Use the final production single-file HTML / published v0.2 URL. Run on the authorized browser executor with its already-installed official Playwright module and Chrome/Edge executable:

```sh
node scripts/production-v02-smoke.mjs \
  --playwright-module /verified/existing/playwright/index.js \
  --executable /verified/installed/browser \
  --url https://verified-v02-preview.example \
  --output /writable/path/v02-smoke-results
```

The sample paths/URL are placeholders. This script does not install anything, reuse a personal browser profile, supply custom browser flags, add debug hooks, mutate app state, or fast-forward the game. Its launch security settings match `production-smoke.mjs`. Overall observation is bounded to about two minutes; the untouched defeat run gets at most 65 seconds (the default-config focused simulation measured 42.35 active seconds). A throttled or graphics-blocked run is reported honestly, never marked as a gameplay pass.

Only v0.2 changes are checked. Do not rerun the old broad `production-smoke.mjs` or `production-touch-bomb-smoke.mjs` as a v0.2 acceptance claim: their v0.1 expectations/flows are outdated. Baseline mechanics used below are setup steps, not a rerun of unchanged regression coverage.

## Automated evidence

At 1280×720 with real mouse input:

- Production `__rocksnake` hook is absent; public HEAD and FINISH markers are visible.
- A full six-item belt moves left; the original exit barrel disappears; the seventh starter barrel arrives at the right entrance.
- Opening that seventh barrel exposes a visible rewind token; tapping consumes it and shows rewind feedback.
- The eighth starter reveals a distinct purple slow token. Tapping consumes it, starts the visible five-second countdown, and the countdown naturally clears while the conveyor continues moving.
- During a held worker drag, other belt items continue moving. The source expires at its carrier's exit and its public marker/drag message disappear. A late mouse release over a matching surviving worker does not restore or merge it.
- The sole pad miner is first moved to the belt for the drag-expiry test. This isolates the visible coin counter: no reward is allowed across expiry and late release.
- A fresh untouched run reaches Game over, offers only Restart, stops head movement/coin changes, and restarts from the defeat dialog.
- Uncaught page errors fail the run. Console diagnostics and failed requests remain in `report.json` for review.

At 360×640: a fresh-scene screenshot and visible markers only. This is not portrait interaction, emulated-touch, or physical-device coverage.

## Screenshot review required

Inspect the generated PNGs, not just their existence:

1. `*-initial-half-route.png`, `landscape-idle-start.png`: rigid individual low-poly stones; head near the route midpoint; open route ahead; legible HEAD/FINISH; no clipping in either layout.
2. `landscape-rewind-visible.png` and `landscape-rewind-used.png`: distinct cyan token/glyph and backward head movement.
3. `landscape-slow-visible.png`, `landscape-slow-active.png`, `landscape-slow-expired.png`: distinct purple clock, readable countdown, and cleanup after the effect.
4. `landscape-held-drag.png`, `landscape-expired-while-held.png`, `landscape-late-release.png`: no stale worker mesh, ghost, or drop ring after expiry.
5. `landscape-game-over.png`: head at the finish, complete chain still rendered, and Restart-only defeat dialog.
6. `landscape-defeat-restart.png`: fresh midpoint start after Restart.

The report deliberately uses `automated_pass_visual_review_required`, not a blanket visual pass. Screen-space marker movement does not prove arc-length values, continuous rigid geometry, backward gap closure after destruction, or WebGL mesh cleanup. Exact gap closure, both rewind branches (midpoint and near first miner), elapsed-time acceleration with its cap, and snake-only 0.5× slow for five seconds with timer refresh and smooth final 0.5-second recovery must be covered by the focused v0.2 simulation tests. No state-injected production proof is permitted.

## Record actual results

Deliver the report, inspected screenshots, deployed HTML hash/byte size, actual browser version, and focused simulator results. Distinguish failed, blocked, not run, automated pass, and visually reviewed. Authoring or syntax-checking the smoke script is not a browser test. No physical-device test, performance benchmark, five-minute soak, old broad regression, or end-to-end bomb targeting is claimed by this script.
