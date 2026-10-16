# Tactile feedback iteration (prototype/0.4)

Presentation-only iteration on canonical `9aa11b99ebcbac14b965a14ca18abe0238ccc4e5`. Economy, balance, bonus rules, logical positions, mining timing, and camera settings are unchanged.

- Contact compresses the selected item immediately; held items lift and enlarge slightly. Placement settles with a short squash. Invalid/canceled drags return safely with a small settle.
- Reveals spring open; merges add a larger hop, tool celebration, and local mint ring. Purchases pulse the wallet and platform. Upgrade purchases pulse their button too.
- Mining hits give a small rigid rock recoil and a miner body impulse. Existing localized chips remain. Bonus rings retain distinct colors. No extra camera shake or simulation hit-stop.
- Ten pooled rings and the existing bounded particle pool prevent unbounded allocation. Reduced motion removes ballistic particles, wiggles, squash, jumps and camera shake; fading fixed-size rings and color feedback remain.
- Original procedural Web Audio effects (not AI-generated recordings), no music or network audio assets. First gesture unlock; visible sound toggle; low master volume, four-voice cap, rate limits, and one prioritized cue per simulation frame. Pausing, losing focus and backgrounding immediately stop all active/queued sources; resuming preserves mute and cannot replay stale sounds. Unavailable/blocked audio is optional and cannot prevent gameplay.
- Hit/drop coordinates remain logical and unaffected by model scale/tilt. UI press feedback does not move button hit rectangles. Wallet pulses are throttled.

## Verification

Focused new tests cover bounded motion/settling, reduced motion, sound event priority and unavailable audio, render state/hit-coordinate stability, ring pooling/reset, first-contact feedback and pointer cancel, safe invalid drop and duplicate release. Run:

`npx vitest run tests/unit/tactile-feedback.test.ts tests/unit/v02-feedback-barrels.test.ts tests/unit/input.test.ts -t tactile`

Also run `npm run typecheck`, `npm run build:playable`, and `npm run check:budget`. This is focused validation, not a rerun of the historical full test suites. Real-browser/physical-device audio listening and touch feel require preview review; no phone performance claim.
