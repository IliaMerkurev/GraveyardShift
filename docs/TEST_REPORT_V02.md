# prototype/0.2 final validation report — 2026-10-13

Historical checkpoint: the later six corrections and their evidence are in [TEST_REPORT_FEEDBACK.md](TEST_REPORT_FEEDBACK.md). This report does not certify the updated build.

The checkpoint sections below retain the evidence available at each step. The final production result at the end supersedes their earlier pending status.

## New/affected checks actually run

- New core-rule model suite: 19 passed. Initial focused run had one test-fixture failure (attempting to reuse an already-consumed barrel); fixture corrected and focused suite passed.
- New rewind/expiry/defeat pointer and rewind primitive cases: 7 passed; existing cases skipped.
- New snake-only slow model cases: 8 passed.
- New slow pointer and primitive cases: 4 passed; previously executed cases skipped.
- Total new cases: 38 passed across these focused runs. No full legacy unit/browser suite was rerun, as requested.
- Strict TypeScript check: passed on final core+slow source.
- Production Vite/single-file build: passed. Embedded JavaScript syntax validation passed. No development hook, external asset, source map or runtime-network dependency remains in the export.
- Budget: 594758 bytes, under both 2000000 target and 5000000 hard limit.
- HTML SHA256: `7c915e1c2a57c151334a9a76c1847d6e0a66cb4d1186979f040bce56301eaf41`.
- New production delta script `node --check` and CLI `--help`: passed. This is script validation, not browser QA.

No cloud browser was launched. Actual production browser/visual QA and deployment belong to the parent workflow and are pending at this checkpoint. The script covers real mouse behavior plus portrait screenshots; it does not claim physical touch or broad old regression coverage. The existing restrictive CSP is unchanged, including the known host-injected Cloudflare limitation.

Canonical remote baseline and rule choices are documented in RULES_V02.md. Publication is a separate connector operation and is not claimed by this report.

## Second important checkpoint: uncapped matching levels

- Added 11 new model cases: matching 5→6, 6→7, later levels, repeated release, high-level mismatch, growing finite damage and actual high-level impact, and machine-safe saturation. All passed.
- Added 8 new primitive cases: preserved original palette, deterministic distinct later colors, high/MAX_SAFE levels and unchanged geometry. All passed.
- Read-only review suggested explicit belt-to-belt evidence: added and ran that one new case, passed. Previously passed cases were skipped for this last run.
- Total new cases across this iteration: 58 passed (38 core/slow + 12 uncapped model + 8 uncapped visual), not a rerun of the full old suite.
- Final strict typecheck/build/embedded JavaScript syntax/static budget passed on uncapped source. Frozen HTML: 595347 bytes, SHA256 `3827d4c1a6c327b91816db24d1c002e801f7fba86510b2369ed0c6d8c9d8aa4c`.
- Independent read-only review found no concrete blocking defect; no browser or repeated tests were run by that review.
- Core/slow source checkpoint was remotely verified separately at `7766c9dcc8361d7cb33b23c12f55eaa9fdeefa44`, tree `78868d4f23b067682a0ec348e9db2e65a0702855`. This second delta uses it as canonical parent. Its publication and final production UI QA remain parent-owned and unclaimed here.


## Final production validation — 2026-10-13

The parent supplied the completed targeted Dreambook QA result: **9/9 checks passed in one approximately 69-second run** against the final v0.2 build. The executor disconnected only after the completed result was read; this did not interrupt QA. No repeated run or old full regression suite was performed.

- Full belt continued moving; exit items expired and carriers refilled.
- Rewind was revealed and consumed through real input; the head moved backward.
- Slow countdown visibly decreased from 4.9 to 4.5 seconds, expired naturally after approximately 5.09 seconds, and the belt continued moving.
- Held belt-origin drag expired. Late release caused no revival, merge or reward; coins stayed 50→50.
- Untouched play reached Game over at approximately 43 seconds. The dialog offered only Restart, head/coins stopped, and Restart restored a fresh run.
- Uncaught page errors: none. The known host-injected Cloudflare script remains blocked by the unchanged CSP.

The QA executor inspected all generated screenshots. The parent and implementation task separately viewed the portrait initial state and landscape defeat images: the initial head is around the route midpoint with clear route ahead, rigid separate stones and visible finish; the defeat dialog is readable and exposes one Restart action. Some chain geometry is obscured by that dialog, so that frame is **not** evidence of complete unobstructed chain geometry.

Known cosmetic issue deferred to the later visual phase: HEAD overlaps FINISH behind the defeat overlay. No polishing or gameplay changes were made after this QA. Physical touch, a new touch run, performance/soak, naturally reached high-level browser merges and complete production bomb-geometry testing remain outside this bounded run; their existing/new logical evidence must not be misrepresented as production UI proof.

Evidence: the parent-retained production report and initial/rewind/slow/defeat image attachments. Final app artifact remains 595347 bytes, SHA256 `3827d4c1a6c327b91816db24d1c002e801f7fba86510b2369ed0c6d8c9d8aa4c`. Source gameplay checkpoint remotely verified at `8d3e5fd642ce5637f6431f201105d1d078c064bf`, tree `33b09cf2950c3e15f3e638f061b305b8642372cc`. This final change is documentation only; no rebuild or gameplay rerun is needed. Stop prototype/0.2 here pending owner feedback; do not begin the visual phase automatically.
