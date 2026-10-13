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

Run `npm run test:v02` for new/affected v0.2 rules only, plus typecheck/build/budget. At the owner’s request, do not repeat already-verified legacy suites. See [v0.2 rules](docs/RULES_V02.md) and [new-rule production QA](docs/QA_V02.md). Historical results below belong to v0.1, not this build.

## Production QA without a fresh install

If an authorized computer already has Playwright and Chrome/Edge, the standalone scripts in [docs/PRODUCTION_QA.md](docs/PRODUCTION_QA.md) use those exact paths. Start with the short boot/screenshot check, then the bounded visible-UI mouse smoke. A separate short portrait script covers emulated touch cancellation, merge and bomb targeting. None needs @playwright/test, custom browser flags or a personal profile.

## Play

The head begins halfway along the route and gradually accelerates toward FINISH. Reaching FINISH ends the run. Mining and bombs remove links and shift the front backward toward the tail. Tap a barrel to reveal a worker, coins, a bomb, cyan rewind token or purple slow token; tap the token to rewind the whole chain to the middle, or near the first miner if already earlier. Rewind preserves speed. Tap a purple clock token for a five-second snake-only slowdown; the belt and miners keep their normal pace. The belt keeps moving during drags: anything reaching its left exit is lost, including a currently dragged item whose belt source expires. Drag matching worker levels together on the belt or a pad, including beyond level 5. Higher levels increase mining damage while retaining the same worker geometry. Tap a priced pad when you can afford it, then drag a worker there to mine. Drag workers back to a free belt space or between pads. Drag a bomb onto the resource stream; its ring previews the blast. Invalid moves return to the moving source only while it still exists. Restart resets the run; Help explains the controls. The prototype milestone is a level-3 worker and one purchased pad; continuing is allowed.

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
