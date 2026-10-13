# Test report — RockSnake v0.1

Date: 2026-10-13. **Real production mouse and emulated-touch gameplay passed the bounded checks below.** The full acceptance suite is not complete: physical touch, five-minute soak, offline interception and rendered performance remain untested. No game changes were required after laptop QA.

## Standalone artifact and publication

- File: `dist/playable/index.html`
- Size: **587,682 bytes**
- SHA-256: `3ec1f871274a36b54c20aa1f490b3ffa2b2a50815fc85223dda5af1320605206`
- Desired ≤2,000,000 bytes and hard <5,000,000 bytes: PASS.
- One inline JavaScript module and inline stylesheet; no external game assets, dynamic import, HMR, source map or development hooks. Final embedded JavaScript passes the mandatory Node module syntax gate.
- Public production QA URL: https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site
- Private source repository: https://github.com/IliaMerkurev/RockSnakePlayableTest . Independently verified remote base before this documentation iteration: `aafcd6cd7ac3e5d58e199a797f6ae30c7d98ed28`, sole/default branch `prototype/0.1`. Final follow-up SHA must be verified after publication; a local commit is not that proof.
- Public hosting explicitly approved by the owner replaces the original VM-browser delivery. No main/master branch, PR, merge, force-push or visibility change was introduced.

## Non-browser checks

- Pinned dependency installation and `npm ci` from the committed lockfile succeeded. An interrupted clean-install attempt was retried once with explicit authorization after verifying the original had stopped. An optional Node-typing installation was cancelled without a manifest change and was not retried; no extra dependency was added.
- Strict `npm run typecheck`: PASS.
- `npm test`: **56 tests in 4 files PASS**: 39 game-state/simulation, 12 pointer-controller with event/capture stubs, 2 primitive visual-contract and 3 inline-export regressions.
- Coverage includes legal/max/different-level merges, occupancy conservation, reservation/cancellation, idempotent barrel/purchase/reward operations, shared mining/bomb destruction gate, starting-miner earnings, target retention, seeded reset, fixed-step 30/60/120 Hz equivalence and 2,400 adversarial actions. No instrumented coverage percentage is claimed.
- `npm run build:playable` and `npm run check:budget`: PASS.
- All three standalone production smoke scripts pass `node --check`.
- Full E2E harness: **40 cases discovered, not executed**. Covers additional viewport sizes, multitouch, interruptions, five-minute soak, standalone offline and WebGL2 fallback.
- Local pre-push guard: main destination rejected (exit 1), prototype destination allowed (exit 0); executable and installed with `core.hooksPath=.githooks`.
- Independent read-only reviews found no further blocking core ownership/reward/reset bug. Unit tests and reviews do not substitute for rendered browser evidence.

## Actual production browser QA

Executed through the authorized Windows laptop executor with existing Node 24.19.0, Playwright runtime 1.62.1 and installed **Edge 155.0.4283.45**. Fresh headless contexts, sandbox enabled, no personal profile or custom graphics/security flags. Playwright's default unsafe SwiftShader argument was explicitly removed. A first launch was blocked by temporary-profile access; the supported executor escalation subsequently succeeded without changing those launch settings.

### Mouse: 360×640 and 1280×720

`production-smoke.mjs`: **22 checks PASS, 2 strict console checks FAILED** solely for the hosting CSP event described below. `pageErrors` was empty in both contexts. These are actual mouse operations against visible production targets, not debug/state commands.

Both formats passed:
- WebGL2 scene boot with six barrels and one worker.
- Starting miner increases coins from 0 to 5 without opening a bonus.
- Restart restores the initial visible state.
- Barrel tap reveals a worker; real drag merges it into level 2.
- Bonus barrel adds 50 coins; the affordable 50-coin pad can be bought.
- A second worker can be dragged onto that pad.
- Help pauses the coin count; Continue returns to play.
- Repeated Restart preserves the initial object counts.

Six screenshots were inspected on the executor. Portrait/landscape gameplay screenshots were also inspected in the implementation workspace and delivered to the owner. They show both workers, distinct level numerals, rocks, pads, prices and the conveyor without obvious clipping of the gameplay zones. This is evidence for these two sizes only, not every responsive size or DPR.

### Emulated touch and bomb: 360×640

`production-touch-bomb-smoke.mjs`: **9/9 gameplay checks PASS**, `pageErrors: []`. The exact executed script SHA-256 was `f72439e9d657978c2d456903436a66c5ece5da12af8bfe22e79286adc7e1e638`. A later one-line report precedence correction preserves `partial_bomb_skipped` when no point is provided; it does not change this tested point-supplied path. That optional no-point path has not been browser-rerun.

Official CDP touchStart/touchMove/touchEnd/touchCancel input, with no direct application-handler calls or development hooks, confirmed:
- Touch tap opens a worker barrel once.
- A worker visibly leaves its source; touchCancel returns it without merging or changing worker count.
- Touch drag merges matching workers into level 2.
- Touch returns that miner to a free belt carrier; coins then remain stable with no pad miner.
- Touch reveals the bomb, drags it to the visually inspected rock row at (180,294), consumes it and raises coins **0 → 125**.
- Two taps on the emptied source grant no further reward.
- Touch Restart restores one level-1 miner, six barrels and no bomb.

The before/after screenshots were inspected by the executor and in the implementation workspace. Before release, a green circular preview surrounds the intact middle rock row. After release, the row has a clear gap around x≈125–232, visible burst particles and the 125-coin wallet. This confirms a visible blast effect and removed rocks in this scenario. It does not prove all boundary cases or simultaneous mining/bomb races; those have unit coverage only.

This is **emulated touch**, not a physical iOS/Android device or a complete touch playthrough of every mechanic.

### Hosting CSP observation

The hosted response includes an injected Cloudflare script that creates a hidden iframe and attempts to load `/cdn-cgi/challenge-platform/scripts/jsd/main.js`. The standalone export's CSP blocks it. Both strict mouse console checks therefore fail despite passing gameplay and no uncaught application errors. The touch report retains the same console evidence separately.

Do not report a clean console, remove the evidence, or weaken the CSP. The hosted HTTP response is larger than the frozen standalone file (observed 588,620 bytes, varying hash due to injected content). The source artifact size/hash above refers to the exact exported file, not the host-modified response.

## Earlier blockers and corrections

1. Initial hosted export produced a real `SyntaxError: missing ) after argument list`. Extracting the exact final script reproduced it under Node. Replacement-string interpolation had expanded a literal dollar/backtick sequence from Three's bundle into an HTML prefix.
2. JS/CSS inlining now uses callback replacement; regression tests and mandatory post-inline syntax validation prevent recurrence.
3. Cloud Chromium reached the intended “WebGL 2 is unavailable” fallback at 500×757. It did not render gameplay. Laptop Edge provided the successful production runtime above.
4. Chromium startup in the development execution sandbox failed on its local IPC socket. The supported escalation returned `TurnAborted`; this route was not bypassed or retried. No Canvas fallback or unsafe-renderer workaround was added.

## Not tested / not claimed

- The complete 40-case E2E suite, multitouch, all resize/blur/visibility/lost-capture paths and all merge boundary cases in a browser.
- 390×844, 768×1024, rotated 640×360, different DPRs and physical phones/tablets.
- Five-minute browser soak, stable GPU resources, calls, triangles, FPS or device-performance benchmarks.
- Blocking every post-document network request while playing; the export is statically self-contained, but a runtime offline pass is still absent.
- Invalid bomb drops and blast-radius edge conditions in production; neither is implied by the valid bomb scenario.
- A real ad-network SDK, MRAID/ExitAPI certification, store redirect or generated art. These are outside v0.1.

## Reproduction and stopping point

See `PRODUCTION_QA.md` for the no-install production scripts. Full development E2E elsewhere requires an authorized bundled browser setup (`npx playwright install chromium`, then `npm run test:e2e`); its default suite includes a real five-minute soak. `--grep-invert @soak` excludes that long case, not a completed soak result.

Stages A–E have implementation, unit/build evidence, public delivery and a bounded actual production playthrough. Remaining acceptance gaps are explicit above. Stop at v0.1 for owner feedback; no new features, art generation or main merge.
