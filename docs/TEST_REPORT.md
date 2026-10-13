# Test report — integration checkpoint

Date: 2026-10-13. All statuses below distinguish executable evidence from intended acceptance. Final browser/host/Git results are pending.

## Executed

- npm dependency installation: succeeded in the dot execution workspace, Node 24.19.0 / npm 11.9.0.
- TypeScript strict check: passed for integrated source; E2E harness was being completed and is rechecked before the checkpoint commit.
- Pure game unit suite: passes, including atomic merges, all legal levels, rejection at max/different level, reservation/cancel, idempotent purchase/barrel/destroy, bomb/mining shared reward gate, target retention, seeded reset, 30/60/120 Hz equivalence, conveyor full/entry behavior and 2,400 adversarial actions.
- First standalone integration export: 583,603 bytes, below desired 2,000,000 and hard 5,000,000-byte limits. This checkpoint size is superseded by the next final build measurement.
- Static export checks: one HTML, embedded JS/CSS, no script src / external stylesheet / source map / HMR / dev read-only hook.

## Blocked / not performed

- Playwright Chromium launch: failed before opening a page. System Chromium 154.0.8037.57 exists, but execution sandbox denies its IPC socket (`Operation not permitted`). Supported `require_escalated` attempt returned `TurnAborted`. No alternate bypass attempted.
- Automated mouse/touch E2E, viewport screenshots, five-minute browser soak and production network-interception test: not yet run due to that browser startup blocker. Test harness is included but is not execution evidence.
- GUI layout/geometry, rendered calls/triangles/FPS: not yet measured. No GPU device is exposed; any later VM software-rendering numbers must not be described as mobile performance.
- Physical iOS/Android devices: not tested.
- Hosted manual gameplay and public URL: parent coordinating approved hosting; no successful delivery claimed yet.
- Git remote push/SHA: pending access workflow; local branch only until independently verified.

## Stage log

A: package and reference inspected; exact orphan branch and pre-push guard installed; strict stack and primitive scene built. First visible browser frame blocked by Chromium IPC, reported immediately.

B/C: real mining/conveyor/drag/merge/purchase/bomb logic implemented and exercised in pure-state tests.

D: DOM tutorial, goal, restart, pointer lifecycle, safe pause and responsive scene/HUD implemented; actual browser acceptance still pending.

E: standalone export and budget scripts run; tests/docs/Git/host handoff in progress. No v0.2 work or main merge authorized or attempted.
