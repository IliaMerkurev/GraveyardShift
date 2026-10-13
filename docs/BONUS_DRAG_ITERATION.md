# Barrel rewards, bonus dragging, and gentler acceleration

Owner playtest corrections, 2026-10-13. These supersede earlier reward/gesture descriptions.

- The apparent empty barrel was the coin-only branch: opening it deleted both barrel and slot cargo immediately, leaving only +50 coins and short particles. Hiding empty carrier meshes could not address this outcome.
- Coin barrels now grant the same +50 exactly once and reveal a persistent cyan rewind token with the same entity ID. Worker, bomb, rewind and slow barrels keep their visible payloads. Unknown legacy content falls back to rewind without an invented coin payout. Empty-carrier hiding and replacement/disposal of old barrel meshes remain.
- Rewind and slow support both tap activation and dragging onto the field. First pointer contact reserves the moving source, so a held token survives conveyor wrap. A release after crossing the drag threshold only attempts a drop; it cannot also tap. A tap restores ownership before using the token once. Repeated activation sees no entity and cannot consume twice.
- Field drops use a finite route-and-ground footprint, including the snake route, excluding worker/purchase pads. Canvas bounds, visible HUD areas and the belt in either orientation are excluded in pointer targeting. A green ring marks valid ground; red marks invalid ground/pads. Bomb target selection is unchanged.
- Invalid drops, pointer cancellation, lost capture, pause and game over return held tokens through the existing reserved-source path without spending them. They remain subject to normal conveyor expiry after they are no longer held.
- Acceleration is halved again: 0.34 + 0.0025t + 0.000375t² units/s. Initial speed 0.34 and growth factor 0.15 are unchanged; gains are half the immediately preceding public version. Values at 20/40/60 active seconds: 0.54 / 1.04 / 1.84. No mining, gap, pull, recoil or slow-duration tuning changed.

## Build and verification boundary

No test suite, typecheck, browser QA, Dreambook operation, or simulation test run is performed, as requested. Source paths and pointer lifecycle were inspected. Numeric expectations in the existing speed checks were updated without executing them; older barrel tests and browser procedures may need adaptation before any future authorized test run.

Build directly with `node node_modules/vite/bin/vite.js build && node scripts/build-single.mjs`, bypassing the npm build script's typecheck preflight. Vite necessarily parses/transpiles/bundles the source. The standalone packager necessarily inlines JS/CSS, adds the existing restrictive CSP, scans for external/development references, and checks the embedded JavaScript syntax before writing HTML. Those packaging safeguards are not gameplay testing. No test results are claimed for this build.

Parent owns publication of the frozen delta to prototype/0.2 and deployment to the same existing Site. No direct Git push, main merge, extra art work, or new Site is part of this iteration.
