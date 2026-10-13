# Feedback-only production QA

## One bounded run on the updated existing Site

Run this new script once on the authorized Dreambook executor, after the updated single-file production build is deployed to the existing Site. Use its verified, already-installed Playwright module and Chrome/Edge executable, exactly as for the prior production smoke:

```sh
node scripts/production-feedback-smoke.mjs \
  --playwright-module /verified/existing/playwright/index.js \
  --executable /verified/installed/browser \
  --url https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site \
  --output /writable/path/feedback-smoke-results
```

The local paths above are placeholders. A module directory is also accepted. Quote paths containing spaces. Do not install a package/browser or use a personal profile. Launch options preserve sandboxing and exclude Playwright's unsafe SwiftShader flag; no custom browser flags or security relaxation are allowed. A graphics/access blocker is a blocker, not a reason to change those settings.

The browser has a 115-second watchdog, including navigation, gameplay and screenshots. Expected normal duration is roughly one minute. A slow renderer can make a motion check inconclusive. No clock fast-forward, debug hooks, state injection, scripted rewards, or legacy full suite is used. Do not run the previous v0.2 smoke: its held-worker-expiry assertion is intentionally superseded by this feedback.

Exit 0 means **automated pass, visual review still required**. Exit 1 means failed/inconclusive gameplay or missing coverage; exit 2 means setup/runtime blocked. Read `report.json`, rather than interpreting process completion as success. Uncaught page errors fail the result; raw console errors and failed requests are retained, including any pre-existing hosting diagnostics.

## Six changed behaviors

1280×720, real Playwright mouse input:

1. **Coin-barrel cleanup.** Open the deterministic third starter barrel; assert exactly +50 coins, no surviving barrel entity, empty/unreserved source ownership, and no idle empty-slot plus marker. Inspect the screenshot for actual empty carrier/model cleanup. This is not a claim that DOM absence alone proves WebGL disappearance.
2. **Substantial elapsed acceleration.** Move the only miner to the consumed coin barrel's slot through real drag input, then observe to 20.8 active seconds with no miners, gaps or bonuses. Fit actual head-distance samples to the quadratic motion curve. Expected initial speed ≈0.34, acceleration ≈0.017, speed at 20 s ≈0.68, ratio ≈2.0. Also compare public signed forward speed with `min(0.85, 0.34 + 0.017t)`. The natural no-miner run reaches the finish before it reaches the cap; sustained 0.85 cap verification belongs to focused model tests, and is not claimed from this browser run.
3. **Held worker survives source exit.** Open the second starter worker, keep it held while its source carrier crosses the exit and wraps, verify another belt item continues moving and the same worker/source reservation survives, then release outside the canvas. Verify exactly the same level-one worker returns to the reserved source without duplication, merge, or coin changes. Inspect the held-after-exit and return screenshots for model/ring cleanup.
4. **Affordable locked-pad drop.** With mining isolated, drag a worker directly onto the locked 50-coin pad. Sample ownership and coins across the release: each rendered frame must be entirely before the purchase or entirely after purchase and placement, with one worker and one 50-coin debit. A separate short 360×640 check repeats this changed action with existing Playwright CDP `Input.dispatchTouchEvent`. This is browser touch emulation, not a physical phone/touchscreen test. The underlying command's atomicity is also a focused model-test responsibility.
5. **Whole-chain rewind animation.** Reveal the deterministic seventh starter rewind token, wait naturally until five active seconds, then tap it. Record actual distance and projected ground position for every stone about every 25 ms, plus intermediate screenshots. Require multiple distinct backward frames, no large single-step teleport, preservation of IDs and equal translation for all stones, and approximately 1.2 active seconds until normal motion returns. These are actual distance assertions, not assertions of the motion label alone.
6. **Destruction pause and gap contact.** Isolate mining, reveal the starter bomb, and drag it onto the public projection of an interior stone. Record the actual removed IDs and surviving positions around destruction, then a ≈0.35 s stationary head interval. Measure the front boundary retracting at ≈1.2 path units/s while the rear boundary stays anchored, until the gap reaches the normal 0.245 spacing without overshoot and forward motion resumes. Capture pause, early-retraction, near-contact and contact frames. This isolated bomb scenario avoids conflating repeated mining hits and independently delayed gaps; those edge cases stay in focused model tests.

The setup moves/Restart clicks are only prerequisites for these six scenarios. No unchanged broad mining/merge/defeat/slow suite, performance benchmark, offline test, soak, or other full regression coverage is claimed.

## Read-only production evidence contract

The smoke reads renderer-synchronized DOM attributes only:

- `canvas`: `data-time` (active simulation seconds), `data-motion` (`forward`, `rewind`, `gap-pause`, `gap-retract`, with paused/ended states allowed outside a scenario), `data-speed` (signed commanded path speed), and `data-stones` JSON.
- Each `data-stones` entry is `{id, distance, x, y}`. Coordinates are canvas-relative projections at ground y=0 and supply the same public location evidence used for targeting and screenshots. Include negative-distance stones to demonstrate full-chain rewind preservation. Reading these records does not give the test control over the game.
- `[data-marker="head"]`: `data-distance`.
- Existing `[data-entity]` targets: `data-kind`, `data-level` for workers, `data-location-kind` and `data-location-id`.
- Existing `[data-pad]` and `[data-slot]` labels: `data-entity-id` (empty string if unoccupied), `data-reserved`; pads also expose `data-unlocked`. Slot projected `style.left/top` continues to update while its label is hidden. Empty slot labels become visible only during a real drag.

These attributes mirror rendering/state already visible in the game. They are not a debug API, a command surface, a cheat, or permission to inspect private JavaScript objects. The script checks that the production `window.__rocksnake` development hook is absent; it never invokes or installs one. `page.evaluate` only reads DOM and collects local RAF samples. All actions use ordinary mouse or emulated touch input.

The motion label is supporting evidence. Assertions measure actual distance changes and record the projected coordinates. No claim of correct mesh pixels follows from a label or a JSON value alone. Active simulation time and browser wall time are both saved so throttling is visible. A sample gap greater than 0.14 active seconds fails smoothness coverage rather than silently claiming it.

## Artifacts and required review

`report.json` records the verified URL, exact fetched HTML byte count/SHA-256, browser version, input mode, each assertion, console/page errors, request failures, screenshot paths and frame-data paths. It preserves failed checks and continues independent scenarios while the overall budget permits.

Read the JSON evidence and actually inspect the PNGs:

- `landscape-acceleration-frames.json`: actual head-distance curve, active time and wall samples through 20 seconds.
- `landscape-held-exit-return.json`: before, held, wrapped and restored source ownership snapshots.
- `*-atomic-pad-drop-frames.json`: exact coin and worker ownership transition on mouse/touch release.
- `landscape-rewind-frames.json`: complete time-sampled chain, including negative-distance stones. Compare the before, early, middle, late and finished rewind PNGs. Check at least three distinct stone IDs/positions across three or more frames, not only HEAD.
- `landscape-gap-frames.json`: pre-destruction, pause, retraction and normal-contact chain coordinates. Compare bomb-preview, pause, early-retraction, near-contact and contact PNGs. Check both endpoints plus another front-section stone across three or more frames.
- Coin cleanup, worker-held-after-exit, invalid-return and affordable-pad screenshots: no stale barrel, empty carrier, worker ghost, price label, or drop ring. Particle effects can legitimately persist briefly.
- The portrait touch before/after screenshots: readable targets, correct placement, no clipping introduced by the changed UI.

Screenshots need human review of visible rigid stones, spacing, continuity, ghosts and target feedback. A headless browser's JSON cannot certify these pixels. Report automated assertions and inspected visual evidence separately. Do not call a screenshot visually reviewed merely because it exists. If a motion/action fails, keep its artifacts and report the specific failed/inconclusive check; do not rerun the old full suite or claim an unperformed physical-device test.

## Completed production result — 2026-10-13

The parent supplied the final Dreambook report: **one 52.3-second run passed all six landscape feedback checks and the portrait emulated-touch purchase/drop check** on the updated existing Site. The QA executor inspected the actual rewind, closure/contact, held-worker and placement frames. Source gameplay checkpoint: `d6699fb95c28be00a1489ac001f9d518c6c9ede3` (tree `9fd9490ce1c637705178c567d9aa08347e10e080`).

- Actual forward displacement: initial speed 0.34014 → 0.68014 path units/s at 20 seconds (1.99958×); fitted acceleration 0.017.
- Gap pause: observed 0.3333 simulation seconds / 333.3 ms wall time, within the requested range and sampled resolution of the configured 0.35 seconds. Retraction measured 1.20 path units/s; contact spacing 0.245. Evidence contained 86 frames with a maximum 0.0333-second sample gap. Inspected frames showed gradual closure and no overlap.
- Rewind: observed 1.1833 simulation seconds / 1181.6 ms wall time across 39 sampled frames. All 74 stones translated backward together; sampled travel 1.92225 units, maximum sampled step 0.05492. Intermediate frames confirmed gradual motion rather than teleportation.
- Held worker survived source-carrier wrap. Invalid release returned the same worker without duplication or ghosts; coins stayed 50.
- Locked-pad worker drops worked with mouse and emulated touch: 50 → 0 coins, with 40 sampled ownership/coin frames consistent with atomic purchase and placement.
- Coin barrel paid +50; its barrel/carrier disappeared, with no idle plus marker or stale empty barrel in the inspected frame.
- No uncaught page errors in either viewport. The known host-injected Cloudflare CSP console diagnostic was retained; the CSP was not relaxed.

The exact 0.85 cap and the alternate near-first-miner rewind branch remain model-test evidence, not claims from this browser run. Touch was browser-emulated, not physical hardware. No full legacy suite, additional browser run, soak or performance benchmark was performed. These final results supersede the earlier authoring-only status; this documentation update does not change or rebuild the 599123-byte app artifact.
