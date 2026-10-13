# Focused QA: current gameplay features

Date: 2026-10-13 UTC. Tests started only after Site v17 publication and owner notification (parent GO at 23:38:44 UTC).

## Frozen production content

- Local implementation commit: `1f6dd3b6bc5684a25c94e5f1388b2d217d954ad0`.
- Published remote implementation commit, reported by parent: `8b58abb255e5287d369b4d5b583d536351a09c9e`.
- Shared production tree: `53e6a3d462355279526e6b81b662216d65397111`.
- HEAD was checked before the run; QA changes touch tests and this report only. No production changes or additional Site build were required for this QA commit.

## Executed scope and result

`npx vitest run tests/unit/v02-current-features.test.ts`: **11 passed** in one focused pass.

Coverage:

1. Snake pause freezes movement, rewind, recoil and difficulty aging; conveyor continues; refresh does not stack; global pause freezes state.
2. Pause preserves gap recovery and frozen render poses, including removal of another stone while paused.
3. Smooth rewind reaches path distance 2.35, preserves IDs/HP and never rewinds forward.
4. Permanent brake subtracts 20% of current speed, consumes once, compounds on current speed and leaves future acceleration unchanged.
5. Adaptive worker reveal range uses current pad workers, favors lower rolls and clamps when the strongest worker is held.
6. Paid worker upgrades double in price, continue improving the lower range after the upper cap, and reject ineffective/unaffordable purchases without charge.
7. Three storage stands support direct and atomic drop purchase, reservations, cancellation and stored bonus use without work-pad progress.
8. Storage rejects worker and unaffordable bonus placement while retaining money and ownership.
9. Worker-only pit discard releases ownership once without reward; bonuses are rejected.
10. Barrel probability boundaries match 50% worker / 15% bomb / 35% equally divided among rewind, brake and pause; no coin payload.
11. Held bonus survives belt wrap, cancels safely and activates exactly once by field drop; an unheld expired bonus cannot activate.

`npm run typecheck`: **passed** after updating directly obsolete legacy test fixtures. The initial failure was restricted to removed `coins` payload / `economy.barrelCoins` references in `v02-feedback-barrels.test.ts`; it was not a production type error. Removing the obsolete coin-only helper required removing its now-unused imports.

Changed legacy case only:

`npx vitest run tests/unit/v02-feedback-barrels.test.ts -t 'opening .* removes the barrel mesh'`: **5 passed, 13 unrelated cases skipped**. The first attempt was blocked by outdated test-only DOM stubs (`window.matchMedia`; classList and element dimensions were also updated). No renderer behavior was changed. Final typecheck was rerun after these fixture edits and passed.

## Boundaries

This is focused model QA plus the directly changed barrel-opening visual reconciliation case, whose GPU/browser are mocked. No old magnetic-motion suite or broad regression suite was rerun. No browser, user computer, touch-emulation or physical-device work was performed by this QA worker. Parent's separate production UI check remains pending and must be reported independently; the model results do not establish portrait readability or real rendering performance.
