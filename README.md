# RockSnakePlayableTest 0.1

Primitive-first browser mining/merge prototype. Authoritative task: [DOTS_TASK_v0.1.md](DOTS_TASK_v0.1.md). This repository deliberately contains no generated models, source video, runtime services or ad-network SDK.

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

The finished export is `dist/playable/index.html`, one self-contained HTML. The preview URL above is local to the execution machine, not a public user URL. The user subsequently approved public built-in hosting for personal gameplay review; hosted QA URL: https://rocksnake-playable-test.pearly-haven-3558.chatgpt.site . The cloud browser opened it but lacks WebGL 2, so actual gameplay there remains unverified. GitHub source remains private.

## Production QA without a fresh install

If an authorized computer already has Playwright and Chrome/Edge, the standalone scripts in [docs/PRODUCTION_QA.md](docs/PRODUCTION_QA.md) use those exact paths. Start with the short boot/screenshot check, then the bounded visible-UI input smoke. Neither needs @playwright/test, custom browser flags or a personal profile.

## Play

Tap a barrel to reveal a worker, coins or a bomb. Drag matching worker levels together on the belt or a pad. Tap a priced pad when you can afford it, then drag a worker there to mine. Drag workers back to a free belt space or between pads. Drag a bomb onto the resource stream; its ring previews the blast. Invalid moves return safely. Restart resets the run; Help explains the controls. The prototype milestone is a level-3 worker and one purchased pad; continuing is allowed.

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

Target: https://github.com/IliaMerkurev/RockSnakePlayableTest (private, independently verified by parent task). Work branch: **prototype/0.1**. **No push or merge to main/master without Ilia's separate explicit instruction.** No main branch exists at initial implementation. No draft PR can be opened without a base; main will not be fabricated for that purpose.

```sh
git config core.hooksPath .githooks
```

The executable local guard rejects main/master destinations. Never use force-push, `--all`, `--mirror`, automatic merge, visibility changes or protection bypasses. A local commit is not proof of publication; the remote SHA must be independently verified.

## Current validation limits

The development execution sandbox prevented Chromium IPC startup. The attempted supported escalation returned `TurnAborted`; it was not bypassed. The hosted cloud-browser check reaches the intended WebGL 2 unavailable message. Automated mouse/touch gameplay, final scene screenshots, rendered performance, five-minute soak, offline runtime and physical-phone tests are not claimed as passed. See the current test report.
