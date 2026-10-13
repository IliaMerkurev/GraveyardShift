# Bonus storage and additive worker-drop upgrades — prototype/0.2

Owner requests, 2026-10-13: three buyable stands preserve bonuses; a separate paid upgrade supplements the dynamic worker-barrel level range, with a doubling price.

## Bonus storage

- Three separate low-poly hexagonal stands cost 50, 150 and 300 coins. Tap a locked stand or drop a bomb, cyan rewind or purple pause onto it when affordable. Purchase and placement are one atomic command. Workers and unopened barrels are rejected.
- Each stand holds one bonus indefinitely. Storage never enters the conveyor expiry loop. Occupied stands reject another bonus; no swapping, merging or automatic activation happens on release over a stand. Empty unlocked stands allow transfers between stores, including a safe return to the source.
- A stored bomb is dragged onto the rock stream to activate; stored rewind/pause bonuses can be dragged onto the field or deliberately tapped, retaining the existing activation gestures. All stand hit regions take precedence over field/track activation, including locked and occupied stands.
- Picking up a bonus reserves its source from pointer-down. Invalid or unaffordable drops, cancellation, global pause and game-over restore the reserved source. A belt-origin source continues wrapping safely while held. Restart resets every stand to locked and empty.
- Stand labels show the coin price when locked, + STORE when empty/unlocked, and STORED when occupied/reserved. Affordable stands and legal/illegal drops have distinct colors. Storage purchases do not advance work-pad tutorial/milestone counters.
- Portrait storage occupies world z=6.05, x=-1.8/0/1.8. The belt moves visually to z=8 with a taller floor/camera frame, leaving more space for stand labels and hit regions; belt speed, spacing and spawn timing are unchanged. Landscape retains its existing belt mapping. Empty stands compete with entity hit targets by nearest distance.

## Worker-drop button

- WORKER DROP displays current additive boost and the next in-game coin cost: 50, 100, 200, 400, and so on. One click purchases one +1 boost, charging once. Insufficient funds, paused/game-over states and active drags reject purchase.
- Base range still reads only workers actually occupying unlocked work pads at reveal time: low=max(1, highest-10), high=max(1, highest-1). Each purchased boost is added to both ends. Highest 13 plus two purchases gives levels 5–14; an empty/low-level map plus one purchase gives level 2 only. This can exceed the highest deployed level by design.
- Lower levels retain the existing squared-uniform preference and seeded RNG. Changes affect only future worker-barrel reveals, including already-spawned unopened barrels; existing workers and barrel-kind odds are untouched. Restart clears the boost.
- The button title/accessibility description reports the effective range. It stays in the footer with a disabled affordability state. Full pause timing remains in the status element; narrow layouts may ellipsize status text to preserve controls.
- Safe-integer checks stop purchases when the next doubling cost cannot be represented safely; effective levels saturate at the existing MAX_SAFE_INTEGER representation limit rather than overflowing.

## Delivery and verification

Only direct Vite bundling and standalone packaging are performed. No tests, typecheck, browser QA or Dreambook work, per the owner's manual-testing instruction. The standalone packager performs its inherent syntax/external-reference checks. Read-only source review informed ownership and responsive spacing adjustments; this is not browser or device verification. Portrait/landscape appearance and gestures remain for the owner's manual review.

Canonical remote parent: e70c16b21f2ae9e1f73cde6e7e2e109f77db938b; matching local base: 6e541a80c4278b44dba96ed02b79a77b486e5beb; baseline tree: c450e28955423a9ee8b23a7133067275c7f9f00b. Publish the frozen delta to prototype/0.2 through the authorized connector. Do not push or merge main.
