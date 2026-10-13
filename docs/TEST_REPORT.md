# Test report — v0.1 implementation handoff

Date: 2026-10-13. **Implementation and non-browser checks are complete; actual gameplay acceptance is blocked by browser graphics availability.** No successful mouse/touch playthrough or physical-device result is claimed.

## Final standalone artifact

- File: `dist/playable/index.html`
- Size: **587,682 bytes**
- SHA-256: `3ec1f871274a36b54c20aa1f490b3ffa2b2a50815fc85223dda5af1320605206`
- Desired budget ≤2,000,000 bytes: PASS
- Hard budget <5,000,000 bytes: PASS
- One inline JavaScript module and one inline stylesheet. No external script/style, dynamic import, HMR, source map or development hook. The data-URL favicon needs no file request.
- Final embedded JavaScript is extracted and checked with Node's module syntax checker as a mandatory build gate.

## Executed successfully

- Pinned dependency installation and `npm ci` from the committed lockfile. A clean-install attempt was interrupted by an approval-review cancellation; after confirming it was no longer running, one authorized retry restored dependencies successfully. An optional Node-typing install was also cancelled, made no manifest change and was not retried; the optional lookup code was removed, with no extra dependency added.
- `npm run typecheck`: strict source, scripts and tests PASS.
- `npm test`: **56 tests in 4 files PASS**: 39 game-state/simulation tests, 12 pointer-controller tests using event/capture stubs, 2 primitive visual-contract tests and 3 inline-export regressions.
- Unit coverage includes legal/max/different-level merges, occupancy conservation, reserve/cancel, idempotent barrel/purchase/reward operations, shared mining/bomb destruction gate, real starting-miner earnings, target retention, seeded reset, fixed-step 30/60/120 Hz equivalence and 2,400 adversarial actions. Coverage percentages were not instrumented.
- `npm run test:e2e -- --list`: **40 cases discovered**, not executed. Includes 360×640, 390×844, 768×1024, 1280×720 and rotated 640×360; mouse and CDP touch; interruptions; five-minute soak; standalone offline and WebGL2 fallback checks.
- `npm run build:playable` and `npm run check:budget`: PASS.
- Safe pre-push hook tested locally: main destination returns exit 1; prototype/0.1 destination returns exit 0. Installed via `core.hooksPath=.githooks` and executable.
- Independent read-only reviews found no further blocking core ownership/reward/reset bug after the exporter correction. These reviews do not substitute for browser execution.

## Actual hosted-browser observations

Hosted QA URL: https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site

1. Initial QA export produced a real `SyntaxError: missing ) after argument list`. The exact published HTML reproduced it under Node syntax checking. Cause: replacement-string interpolation expanded a literal dollar/backtick sequence in Three's minified source into the HTML prefix.
2. Fixed JS and CSS inlining with callback replacements, added regression tests and a post-inline syntax gate. Corrected QA artifact (586,179 bytes, SHA-256 `913b21567e543b80bf284925a7ea70bb263ce11ff744b76920d6f378074d8bdb`) was published and opened successfully past that error.
3. The cloud Chromium then displayed the intended **“WebGL 2 is unavailable”** message at 500×757. This is evidence of fallback behavior, not of gameplay. No game scene was rendered in that browser.
4. The final 587,682-byte artifact above adds the remaining reviewed UI safety fixes and is handed to the parent for publication. This report does not claim that the final deployment has already occurred.

## Blocked / not performed

- Local Playwright browser startup failed before page load: system Chromium 154.0.8037.57 could not create its local IPC socket (`Operation not permitted`). The supported escalation returned `TurnAborted`. No bypass or browser-launch retry was attempted.
- The hosted cloud browser lacks WebGL 2. No Canvas fallback was added because the approved stack requires Three.js WebGL 2.
- Automated E2E, trusted mouse/touch playthrough, rendered layout acceptance, final portrait/landscape game screenshots, five-minute browser soak, GPU-resource stability and production blocked-network execution remain **unverified**.
- Calls, triangles and FPS were not measured in a rendered scene. No GPU device was exposed in the execution workspace. Analytical bounds or unit tests are not presented as rendered measurements.
- Physical iOS/Android devices were not tested.
- Remote Git push and exact remote SHA are not confirmed by this implementation task. Parent coordinates first-push access; local commits/bundles do not prove publication.

## Reproducible browser checks elsewhere

Use the standard bundled Chromium: `npx playwright install chromium`, then `npm run test:e2e`. These are development-only tools. The default suite includes a real five-minute soak. `--grep-invert @soak` runs the shorter cases. The touch driver uses CDP touch sequences; shrinking a mouse viewport is not counted as touch. Tests use read-only development inspection and actual UI commands, never state-mutating cheats.

## Stage results and limits

A: package/reference inspected; exact working branch and guard prepared; strict stack and primitive scene implemented. First visual acceptance blocked, promptly reported.

B/C: real state-driven mining, conveyor, drag, merge, economy, pad purchase and bomb implemented and unit-tested.

D: state-driven tutorial, goal/continue, restart, lifecycle cancellation, DOM UI, responsive five-run portrait and rotated-field landscape layouts implemented. Projection review corrected oversized camera framing and tight conveyor hit spacing. Actual rendering remains unverified.

E: one-file export, syntax/budget gates, tests, docs and local history prepared. Approved public hosting replaces VM-only delivery; source repository stays private. Main/master were not created, pushed or merged. No v0.2, generated art or ad-network integration work started.
