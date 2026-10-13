# Six playtest corrections: focused validation — 2026-10-13

## Source/model evidence completed

- `npm run test:feedback`: **77/77 passed** across the new motion, drag/purchase and barrel-render suites plus the directly affected PointerController suite. This is bounded changed-behavior coverage, not a rerun of the full legacy suite.
- Four directly affected slow tests passed: actual half-speed forward displacement and unchanged belt/active time, unchanged miner impact timing, smooth recovery into the new accelerated base speed, and rewind preserving slow/difficulty state. Four other existing slow tests were skipped.
- Motion regressions verify actual positions: 0.35-second delay; intermediate backward positions; fixed rear; rigid sections and no overlap; forward resumption after contact; independent gaps; repeated boundary damage without perpetual delay; bomb reward exactly once; real mining destruction; pause; whole-chain 1.2-second rewind; negative tail; repeat pickup; gaps/head removal during rewind.
- Ownership/purchase regressions cover multiple belt laps while held, first-contact pickup, mouse/touch, invalid drop/cancel, lost capture, pause, reserved-source refill exclusion, atomic buy/place, insufficient/revoked funds and duplicate release.
- Barrel/render regressions cover all five real payloads, same-ID primitive replacement/disposal, coin reward once, consumption, empty carrier removal, drag-only empty-slot markers and read-only production evidence fields.
- Earlier uncapped matching-level logic and shared worker geometry were left unchanged; their full suites were not rerun.
- Strict TypeScript check passed.
- Production build, embedded module `node --check`, standalone dependency/dev-hook scan and static budget passed.
- New production QA script `node --check` and CLI `--help` passed. No browser was launched for these static checks.
- `git diff --check` passed.
- Independent read-only source review found no blocking defect; it did not claim a second test run or browser execution.

## Frozen app artifact

- `dist/playable/index.html`: **599123 bytes**.
- SHA256: `8df0dc7ebe2e4879120e1f0a2f40e661ae04fc677b5b0c1348b24bd0986ee96d`.
- Under the 2000000-byte target and 5000000-byte hard ceiling.
- Existing restrictive CSP unchanged. No CDN, external assets, state-mutating hooks, source map or development API.
- Read-only DOM attributes mirror live distances, screen projections and ownership for bounded public-browser evidence. These are not control/debug APIs.
- Vite's expected single-bundle >500 kB warning remains; single-file export intentionally cannot be split into network chunks.

## Publication and browser QA status

**Final update:** source gameplay checkpoint `d6699fb95c28be00a1489ac001f9d518c6c9ede3` was published and the updated existing Site passed one 52.3-second Dreambook run: all six feedback checks plus portrait emulated-touch purchase/drop, with actual screenshot inspection by the QA executor. See [measured production results and remaining limits](QA_FEEDBACK.md#completed-production-result--2026-10-13). The app bytes/hash above are unchanged. The paragraph below records the earlier pre-publication checkpoint, not the current status.

At this checkpoint, source publication, deployment to the existing Site and the single focused Dreambook production run are **pending parent-owned actions**. No cloud browser, new Site, desktop operation or direct Git push was performed by the implementation worker. The new script's syntax/CLI validation is not a browser pass.

Use `scripts/production-feedback-smoke.mjs` and `docs/QA_FEEDBACK.md`. The script measures actual positions at multiple times for progressive motion and captures frames for human inspection. Its machine-readable report must be reviewed before production behavior is claimed. Full legacy E2E, soak/performance, physical-touch hardware and unrelated earlier scenarios remain unexecuted this iteration.

Rules/tuning and the safe conveyor return choice are documented in [FEEDBACK_ITERATION.md](FEEDBACK_ITERATION.md). The existing application URL and private source repository remain unchanged; main is not a publication target.
