# Capped, visible worker upgrades — prototype/0.2

Owner correction, 2026-10-13: the paid upgrade must never allow workers above the highest character on the field, and the upgrade button must be much easier to see.

## Effective range and purchase guard

- The existing base window remains max(1, M−10) through max(1, M−1), where M is the highest valid worker currently occupying an unlocked, unreserved work pad. Empty/level-one fields use the existing level-one fallback. Conveyor workers and a worker currently held in a drag do not raise M.
- Each endpoint becomes min(M, base + purchased boost). The implementation clamps the increment before adding, avoiding safe-integer overflow. It recalculates on every reveal, so a lower deployed maximum, a drag, or a return to the pad immediately changes the cap. Already revealed workers are not altered.
- A purchase is allowed only if the next effective range improves at least one endpoint. The upper endpoint may already be capped while another purchase improves the lower endpoint. M=5: 1–4 → 2–5 → 3–5 → 4–5 → 5–5, then disabled. M=13 with two purchases is 5–13, never 5–14. M=1 permits no purchase and no charge.
- The command checks the effect again before deducting coins, independently of the disabled UI. Pause, game over, active drag, insufficient funds, and numeric price limits remain guarded. Existing price doubling, RNG preference, restart, storage, mining, movement, and merging remain unchanged. Boost is retained if the deployed maximum falls, but effective levels remain capped.

## Upgrade visibility

- A full-width high-contrast bottom rail presents a large 54px-high gold action button, readable current worker-level range, and explicit UPGRADE / coin price. Affordable upgrades glow; unavailable upgrades retain contrast. At the field cap it reads MAX ON FIELD · MERGE TO RAISE.
- The rail reserves its own 94px plus safe-area inset. The canvas height and label layer end above it, keeping the control separate from field, bonus storage, and conveyor hit targets. The existing camera fits the reduced canvas using its existing responsive dimensions. The belt/pause status has its own full row; Help retains a separate 44px target.
- Help, the button accessibility description, and purchase feedback explain the live cap. Existing workers are never silently upgraded.

## Delivery scope

Only source review, direct Vite bundling, and standalone packaging were performed. No unit tests, typecheck, browser QA, device QA, or user-computer work was run, per the owner's instruction to test manually. The standalone packager includes its normal embedded-syntax and external-reference checks. Responsive layout and gameplay remain for the owner's manual review.

Canonical remote parent: c8277135b1bef0c31a26b650839dc8a95d2e729b. Matching local base: c15a2c13b7e2c585162f5ac286f65d13c64ca7dd. Baseline tree: 038ba04c0251437f1e4039c070ed107a62e25bdc. Publish the frozen delta only to the existing authorized prototype/0.2 branch; no main push, merge, or local-history push.
