# Moving rear and magnetic contact — prototype/0.2

Owner feedback on 2026-10-13 supersedes the prior anchored rear, whole-chain gap freeze, constant pull and early speed cap. All other previously approved features remain unchanged.

## Actual motion

- Every active non-rewind step advances the rearmost contiguous section. Gap processing does not skip tail replenishment or the finish check.
- Each front section waits 0.35 active seconds from the original destruction boundary, then moves backward toward the moving rear at `3 + 5 × remainingGap` path units/second. Thus an approximately two-unit bomb gap initially pulls at about 13 units/s, versus approximately 4 units/s for a single link. Approach slows with remaining gap and clamps precisely at contact. No teleport is used.
- Sections are snapshotted before any motion, then solved rear-to-front as rigid groups. Middle sections can be pulled backward by a gap behind them while acting as the moving rear for the next gap. No duplicate stones or rewards, coordinate crossings or overlap are introduced. Repeated removal at a boundary preserves its original deadline; independent gaps keep separate deadlines.
- At high difficulty, a rear section can reach a small gap before the 0.35-second attraction delay ends. Contact immediately pushes its front forward rather than letting the rear stop or cross it. The delay applies only while a physical gap remains.
- Contact gives a 0.24-second, up-to-0.10-path-unit forward recoil of the front away from its rear, plus a subtle vertical lift. This is render-only; logical distances and mining remain stable. A head-to-tail rendering constraint prevents recoil from crossing another section or FINISH. Recoil starts/ends at zero and does not create new simulation gaps or repeat itself. Pause freezes it, rewind clears it, reset clears it.
- Explicit whole-chain rewind still owns motion while active, preserves gaps and has the previous 1.2-second duration. Snake-only slow scales forward and magnetic pull speeds; it does not slow mining, belt movement or difficulty time.

## Progressive pressure

Forward speed is `0.34 + 0.010t + 0.0015t²` path units/second for active seconds `t`:

- Start: 0.34
- 10 seconds: 0.59
- 20 seconds: 1.14 (old build: 0.68)
- 40 seconds: 3.14 (old build capped at 0.85)
- 60 seconds: 6.34

It continues growing after these samples. A remote numerical safety guard of 1,000,000 units/s is not a playable balance cap. Time in global pause does not age pressure; slow/rewind do not reset it. The smaller early linear term retains starter mining, while late pressure rapidly overwhelms ordinary mining. This is short-playable tuning, not a claim that every strategy or earning pace is fully balanced.

Focused deterministic measurements use actual fixed-step movement and real mining, without forced defeat or event injection:

- Untouched starter level-1 miner: natural defeat at 22.7167 active seconds, one mined stone at 17.4333 seconds. Its moving rear reaches contact in about 0.25 seconds, before magnetic pull is needed. Actual accumulated rear travel: 16.1698 path units.
- All four pads staffed with level-3 miners: natural defeat at 29.4833 seconds despite 46 mined stones. Rear travel: 27.1948 units. Staffing is a unit-test fixture, not a production hook or economy change.
- Constant 0.34-speed comparison: starter mines three stones in 30 seconds. The stronger curve reduces available target dwell; sticky-target selection is unchanged. No mining or economy adjustments were added.

Physical rear progress is the important correction: frequent mining no longer freezes the whole snake, and every completed closure transfers accumulated rear advancement to the front. The difficulty claim does not rely solely on a speed field.

## Verification and publication

Only the new magnetic unit suite, typecheck, standalone build, inline-JavaScript syntax and size checks run here. Obsolete anchored-rear/difficulty expectations were removed from the earlier motion test file; its independent rewind coverage remains, not rerun. The bounded public-input browser delta is `scripts/production-magnetic-smoke.mjs` with procedure in `QA_MAGNETIC.md`; production browser execution and visual judgment are separate from these unit results.

Read-only DOM mirrors expose logical `distance`, constrained `renderDistance`, recoil `bounce`, actual projected centers, actual last-fixed-step head `data-speed` and nominal current `data-forward-speed`. No production debug controls are added. `data-motion` is an aggregate gap mode and can differ from one section's actual movement when multiple gaps exist; ID-correlated distances are authoritative.

Local base is `d107891eaaf54112260bde16f0e1ed6d12955d65`; canonical publisher parent is `7a20d9d1887321d4475662a36a0d05a09506c628`, tree `c363b9296fa8ef96da47921dfb4de48fbf366cc1`. The publisher must apply the content delta to that canonical parent; no direct push or history rewriting is performed.
