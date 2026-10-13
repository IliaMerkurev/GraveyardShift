# Magnetic-motion and difficulty production delta

## Current owner testing instruction

The latest barrel/bonus-drag update halves acceleration again. No automated tests, typecheck, browser QA, or Dreambook work are run; the owner is testing manually. The procedure and previous results below are historical, not a request to execute them. Only numeric curve expectations were updated. See [BONUS_DRAG_ITERATION.md](BONUS_DRAG_ITERATION.md).

## Build distinction

The owner subsequently requested half the acceleration. Current script expectations use the halved time-dependent gain with unchanged initial 0.34 speed. A browser run already started on the earlier 600,149-byte build (SHA256 `1bf4acb2a159caa0aa6b851f5d868b49f33e511e1cc08ddd1181e67513dc4399`) remains evidence for that prior build; do not restart it or relabel its results as this balance update. No additional browser run is requested by this source change.

## Historical scope and execution (not authorized for this update)

Run `scripts/production-magnetic-smoke.mjs` **once** on the authorized Dreambook executor after the changed single-file build is deployed to the existing Site. This is one bounded browser delta with two directly affected scenarios: isolated magnetic closure, then natural defeat while the ordinary starter miner keeps working. Do not rerun the previous six-feature smoke or broad regression suites.

```sh
node scripts/production-magnetic-smoke.mjs \
  --playwright-module /verified/existing/playwright/index.js \
  --executable /verified/installed/browser \
  --url https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site \
  --output /writable/path/magnetic-smoke-results
```

The local paths are placeholders. Use the verified, already-installed Playwright module and Chrome/Edge executable used by the earlier authorized run. A module directory is accepted; quote paths with spaces. No installation, browser download, personal profile, custom launch flags, unsafe SwiftShader, sandbox relaxation, debug hooks, injected commands/state, or accelerated clock is allowed. A graphics/access restriction remains a blocker.

One fresh browser/context uses a 1280×720 viewport and real Playwright mouse input. A **105-second watchdog** covers browser launch, navigation, all gameplay and screenshots. The ordinary-miner scenario has its own **60-wall-second observation window**, beginning before its real Restart click; it ends early on the genuine Game over dialog. Small sampling/command overhead is recorded separately in the report. In a normal renderer the whole run should be substantially shorter than the overall budget. No mobile/touch rerun, six-feature rerun, soak or performance benchmark is included.

- Exit 0: automated assertions passed; screenshot review is still required.
- Exit 1: failed/inconclusive coverage or gameplay. Preserve and read the artifacts.
- Exit 2: setup/runtime blocker.

Read the result statuses inside `report.json`; process completion alone is not a pass. Uncaught page errors fail the result. Raw console errors and failed requests are retained, including hosting diagnostics, without relaxing CSP or browser security. If the first scenario fails, the independent natural-miner scenario still runs when the budget permits; it is not a retry of the failed scenario.

## Scenario 1: a moving rear and a magnetic front

Setup uses ordinary Restart, barrel tap and drag actions only. The coin barrel provides an empty conveyor slot; the starter miner is parked there to isolate a single destruction event. This setup is not a new claim of coin cleanup or drag-regression coverage. The deterministic starter bomb is revealed and dragged onto the public rendered projection of an interior stone.

The script records the complete public stone array on **every RAF** before release, through removal, front pause, magnetic pull, contact recoil and settled forward recovery. It correlates unchanged IDs, rather than comparing the moving tail's current index or trusting the motion label. Newly supplied tail stones may appear normally.

Assertions establish:

1. **Damage and surviving identities.** A sampled removal transition destroys at least two stones and leaves one measurable interior gap. Both gap endpoints, the original rear-most stone and the head survive. Damage does not teleport surviving physical positions.
2. **Approximately 0.35-second front pause.** The head holds within 0.005 path units, while the same rear boundary and original tail ID each advance more than 0.05 units. Their equal displacement demonstrates a rigid advancing rear section. The measured pause accepts 0.28–0.42 active seconds for sampling resolution; wall duration is saved too. This large-gap bomb scenario deliberately leaves enough space for the pause. Tiny gaps at high speed may close through rear contact before 0.35 seconds; the browser test does not impose an impossible stationary-front condition after contact.
3. **Rear movement during pull.** Both unchanged rear/tail IDs continue advancing, with matching displacement, while the front moves backward. Non-contact measured rear speeds must stay positive. This rejects the old permanently anchored rear behavior.
4. **Fast, distance-dependent magnetic pull.** Actual front-boundary displacement is divided by active time. Samples with substantial remaining gap exclude contact-clamped steps. The largest-gap third is compared with the smallest-gap third: the larger gap must be at least 0.2 units greater and its measured pull at least 20% faster; the small-gap group must still exceed 2.4 path units/s. Every measured pair, its gap, front pull and rear speed is included in the report. The implementation's intended law is 3 + 5 × remaining gap path units/s, limited by contact; focused model tests establish exact fixed-step values. These browser assertions establish the actual fast/decelerating motion without mistaking contact clamping for a wrong speed.
5. **Small contact bounce/recoil.** After contact, the front section briefly recoils forward along the track. `bounce` is the longitudinal rendered offset, not an independent vertical height or physical gap displacement. It must be observed in at least three frames, reach more than 0.05 but no more than 0.10001 path units, and settle over approximately 0.24 seconds (sampled nonzero duration 0.12–0.27 seconds). The renderer adds a subtle vertical lift of 0.2 × this offset. The final observation must have settled to less than 0.002 units.
6. **Physical and rendered contact safety.** Every sampled neighboring separation, both physical and rendered, stays at least 0.245 path units within floating-point tolerance. The same tracked boundary reaches normal contact spacing, no endpoint crosses, the bomb is consumed, and the head subsequently advances again.
7. **Actual signed head speed.** `data-speed` is compared with same-head-ID displacement over single fixed-step RAF pairs, including the negative pull and zero front pause. At least one fast negative displacement/speed pair must be observed. This rejects nominal or difficulty-only speed telemetry.

Pause and pull need at least eight distinct active frames. Their largest sampled gap cannot exceed 0.07 active seconds or 0.14 wall seconds. Single-step telemetry comparisons intentionally exclude multi-step frames because the public speed is the **last fixed-step** velocity, while a multi-step displacement is an average. Insufficient coverage is inconclusive, never a timing pass.

## Scenario 2: actual rising difficulty and natural defeat

Restart once more with the normal level-one starter miner left on its original pad. Make no purchases, add no workers, use no bonuses, and do not disable mining or change the game state. Record each RAF until the actual Game over dialog appears, or the 60-second wall window ends.

The changed forward difficulty is:

`v(t) = 0.34 + 0.0025t + 0.000375t²` path units/s, where `t` is active simulation time.

Reference values are 0.54 at 20 seconds, 1.04 at 40 seconds and 1.84 at 60 seconds. They describe the configured curve, **not a claim that a browser run survives to those times**. There is no reachable old 0.85 gameplay cap; an extreme numerical safety bound remains an implementation detail covered by model tests.

Assertions require:

- The same level-one miner remains on `pad-0` throughout.
- At least one genuine stone removal and coin reward proves ordinary mining occurred. The same rear boundary and original tail advance during the naturally mined gap’s front pause, and that gap closes safely to normal spacing. Any captured short pull interval must show a backward front and advancing rear. A one-link mining gap can close through the moving rear before the pull deadline, or pull for only two or three fixed steps. Backward pull is not required for this early-contact branch, and the mining case does not need the bomb scenario’s eight-frame pull coverage.
- The real defeat overlay appears naturally inside the observation window; a timeout cannot pass.
- `data-forward-speed` follows the new curve throughout the recorded active time.
- Same-head-ID, single-step physical forward displacement follows the curve, using at least 60 eligible frame pairs.
- Mean actual speed during the final three active seconds exceeds twice the initial-period mean and exceeds 1.15 path units/s. The observed times, velocities and ratio are reported.
- Physical/rendered separation stays valid through the naturally occurring mining gaps.
- The public signed speed agrees with actual head motion, excluding the ended frame and changes of head identity.

The report includes elapsed wall time, active time at defeat, removed stone IDs, earned coins, early/late measured speeds, maximum observed forward speed and final head distance. This is one ordinary-starter strategy, not proof that every player strategy loses. A stronger-miner strategy, exact long-time curve references and edge cases belong to focused model tests, not extra browser runs.

## Public read-only evidence contract

The script reads renderer-synchronized DOM only:

- `canvas`: `data-time`, `data-motion`, `data-speed`, `data-forward-speed`, `data-stones`.
- `data-speed`: actual signed **last fixed-step** head path velocity; zero for paused/ended state. `data-forward-speed`: current curve-derived forward speed, which can remain positive while the head holds or retracts.
- Each stone: `{id, distance, renderDistance, x, y, bounce}`. `distance` is physical path position; `renderDistance` includes constrained longitudinal contact recoil; `bounce = renderDistance - distance`. `x/y` are canvas-relative ground projections of the rendered path position. Records include entrance/negative-distance stones when present.
- `[data-marker="head"]`: physical `data-distance`.
- Existing `[data-entity]` kind, level and ownership; slot/pad IDs and ownership for mouse setup; displayed coins and the real visible Game over dialog.

`page.evaluate` only reads these DOM values into local arrays and schedules RAF observations. It never reaches private JavaScript state, dispatches app commands, changes the clock, or installs a global hook. The script checks that `window.__rocksnake` is absent. All gameplay changes come from real mouse actions.

## Artifacts and required visual review

`report.json` contains the exact URL, fetched HTML byte count and SHA-256, browser version, budget, assertion details, raw diagnostics and artifact paths.

- `magnetic-frames.json`: full per-RAF stone IDs, physical/rendered distances, projected x/y, recoil, head/forward speeds, times and ownership. Use the tracked `rearId`, `frontId`, `tailId` in the report to compare the same stones throughout the action.
- `difficulty-frames.json`: per-RAF active/wall time, head identity/position, actual/forward speed, coin totals, all stone IDs, compact `[id, distance]` pairs for real-mining gap analysis, separation/recoil summaries, miner ownership and defeat visibility. Full projected geometry is omitted here to keep the long-run artifact compact.
- `magnetic-before.png`, `magnetic-pause.png`, `magnetic-pull-early.png`, `magnetic-contact-bounce.png`, `magnetic-settled.png`: inspect at least both gap endpoints, the unchanged original tail and another front-section stone across three or more frames. Confirm actual backward pull, rear advance, rigid stones, modest recoil and safe settling. Screenshot metadata records the public state immediately **before** capture; it does not promise pixel/DOM frame-perfect simultaneity. If a timed screenshot misses the short recoil, `visualLimitations` records that missing visual coverage separately from the complete RAF physics assertions. Do not treat the missed screenshot as visually reviewed or repeat the browser run silently.
- `difficulty-start.png`, `difficulty-natural-defeat.png` (or `difficulty-timeout.png`): verify the ordinary starter setup and genuine ending with the head at FINISH.
- Failure screenshots and error stacks are retained; an assertion failure is not replaced by a success claim because other checks passed.

DOM values mirror rendering inputs; they do not certify pixels, absence of stale WebGL meshes, visual quality, or perceived timing. Actually open and inspect the PNGs before reporting visual approval. Keep automated and human-reviewed evidence separate. Do not call an uninspected screenshot reviewed, claim a physical-device test, rerun old suites, or silently retry the bounded browser run.

## Authoring status

The new script was syntax-checked with `node --check` and its `--help` path was exercised without launching a browser. Production results are pending the single authorized Dreambook run and visual review. No production pass is claimed by this document.
