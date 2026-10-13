# prototype/0.2 implementation checkpoint — 2026-10-13

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
