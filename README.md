# RockSnakePlayableTest 0.2

Primitive-first browser mining/merge prototype. Baseline task: [DOTS_TASK_v0.1.md](DOTS_TASK_v0.1.md), superseded where stated by [the owner-approved v0.2 rules](docs/RULES_V02.md). This repository deliberately contains no generated models, source video, runtime services or ad-network SDK.

## Run and verify

Use Node **24.19.0**, npm **11.9.0** (also pinned in `.nvmrc` and `package.json`).

```sh
npm ci
npm run dev                  # http://127.0.0.1:5173
npm run typecheck
npm test
npm run test:e2e
npm run build:playable
npm run check:budget
npm run preview:playable     # http://127.0.0.1:4173
```

The finished export is `dist/playable/index.html`, one self-contained HTML. The preview URL above is local to the execution machine, not a public user URL. The user subsequently approved public built-in hosting for personal gameplay review; hosted QA URL: https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site . Production gameplay was subsequently tested in Edge 155 on Windows: mouse at 360×640 and 1280×720, plus one 360×640 emulated-touch/bomb run. Actual screenshots were inspected. GitHub source remains private.

## Current iteration validation

Latest: [barrel reward balance](docs/BARREL_BALANCE_ITERATION.md): worker 50%, bomb 15%, and rewind/pause/permanent slowdown each 35% / 3 after the fixed starter sequence. Barrels and rewind award no coins. Owner tests manually: no tests, typecheck, browser QA or Dreambook runs for these latest changes. Build directly with `npx vite build && node scripts/build-single.mjs`; the historical commands/results below do not verify this iteration.

For the latest six playtest corrections, run `npm run test:feedback`, typecheck/build/budget and the bounded [feedback production QA](docs/QA_FEEDBACK.md). Do not rerun already-verified broad legacy suites. The 81 focused source checks passed. One 52.3-second Dreambook run passed all six changes plus portrait emulated-touch purchase/drop, with actual motion samples and inspected screenshots; see [production results and limits](docs/QA_FEEDBACK.md#completed-production-result--2026-10-13). Current source-check evidence is in [the feedback report](docs/TEST_REPORT_FEEDBACK.md); [prior v0.2 evidence](docs/TEST_REPORT_V02.md) describes the superseded checkpoint and is historical.

## Production QA without a fresh install

If an authorized computer already has Playwright and Chrome/Edge, the standalone scripts in [docs/PRODUCTION_QA.md](docs/PRODUCTION_QA.md) use those exact paths. Start with the short boot/screenshot check, then the bounded visible-UI mouse smoke. A separate short portrait script covers emulated touch cancellation, merge and bomb targeting. None needs @playwright/test, custom browser flags or a personal profile.

## Play

The head begins halfway along the route and gradually accelerates toward FINISH. Reaching FINISH ends the run. Mining and bombs explode links; after a 0.35-second delay, the front slides backward toward the rear until connected. Tap a barrel to reveal a worker, bomb, cyan rewind token, purple pause token or amber permanent-slowdown token; tap the cyan token to animate the whole chain backward over 1.2 seconds to just before the first bend, without moving an already-earlier head forward. Rewind preserves speed and awards no coins. Tap a purple pause token for a five-second full snake pause; the belt and miners keep their normal pace. The belt keeps moving during drags: untouched items reaching its left exit are lost, but a picked-up item belongs to the drag and stays safe across its source-carrier wraps. Drag matching worker levels together on the belt or a pad, including beyond level 5. Higher levels increase mining damage while retaining the same worker geometry. Drop a worker onto an affordable locked pad to buy and occupy it in one move; click purchase also works. Drag workers back to a free belt space or between pads. Drag a bomb onto the resource stream; its ring previews the blast. Invalid moves and cancellations return to the reserved moving source safely. Restart resets the run; Help explains the controls. The prototype milestone is a level-3 worker and one purchased pad; continuing is allowed.

## Structure

- `src/game`: configuration, pure state, atomic commands, path and fixed-step simulation
- `src/render`: shared primitive worker contract, instanced rigid rocks and effects, scene and projections
- `src/input`: one mouse/touch Pointer Events controller
- `src/ui`: state-driven DOM HUD and tutorial
- `src/platform`: safe browser-only playable bridge; CTA is a local notice
- `tests/unit`, `tests/e2e`: development-only verification
- `docs/DECISIONS.md`, `docs/TEST_REPORT.md`: assumptions and actual results/limits

Before running the browser suite on a supported computer, install the standard bundled Chromium with npx playwright install chromium. The harness works across operating systems without a hardcoded browser path. Browser tooling is development-only.

Development-only read-only diagnostic hooks are available to browser tests. `?debug` displays rendering counters in development. Neither hook nor panel is exported in the standalone HTML. No state-mutating cheats are exposed.

## Git safety

Target: https://github.com/IliaMerkurev/RockSnakePlayableTest (private, independently verified by parent task). Work branch: **prototype/0.2**. **No push or merge to main/master without Ilia's separate explicit instruction.** Canonical main/prototype-0.1 baseline: `67229de8d57221becf8c78f688a277e41c55c45f`. The working branch is published via the authorized connector, never a direct push from alternate local metadata.

```sh
git config core.hooksPath .githooks
```

The executable local guard rejects main/master destinations. Never use force-push, `--all`, `--mirror`, automatic merge, visibility changes or protection bypasses. A local commit is not proof of publication; the remote SHA must be independently verified.

## Historical v0.1 validation limits

56 unit tests and strict typecheck pass. Actual production QA passed 22 mouse checks across portrait/landscape and 9 emulated-touch/bomb checks in portrait, with no uncaught page errors. Two strict mouse console checks failed because hosting injects a Cloudflare script blocked by the export’s CSP; the CSP remains unchanged. Physical touch, full 40-case E2E, five-minute soak, blocked-network runtime and rendered performance are not tested. The cloud browser still lacks WebGL 2; laptop Edge supplied the successful runtime. See [the test report](docs/TEST_REPORT.md) for precise evidence and limits.

### Latest playtest corrections

See [feedback iteration rules](docs/FEEDBACK_ITERATION.md) and [focused feedback QA](docs/QA_FEEDBACK.md). Acceleration is now noticeable within 10–20 seconds; gap closure and rewind are animated; held items survive conveyor wraps; worker drops can buy locked pads; vacated containers are removed.

### Latest: permanent slowdown, worker disposal, easier pickup

Amber ↓20% bonuses permanently reduce the snake's current underlying forward speed while its existing acceleration continues. Purple pause bonuses remain separate. Drag unwanted workers of any level into the orange-rimmed DISCARD WORKERS pit; no coins are awarded. Pickup halos are more forgiving while drop targets remain deliberate. See [rules and source-review scope](docs/SLOWDOWN_DISCARD_PICKUP_ITERATION.md). Owner performs gameplay QA; this iteration only bundles and packages the standalone.
