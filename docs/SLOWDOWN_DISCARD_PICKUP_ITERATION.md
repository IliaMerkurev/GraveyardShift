# Permanent slowdown, discard pit and pickup halos

## Requested changes

- Add a lasting snake-slowdown bonus while continuing acceleration.
- Let the player drag unwanted workers of any level into a disposal pit.
- Make picking up objects less exacting.

## Permanent slowdown

A separate amber `↓ 20%` token (`brake`) is available from barrels. The existing purple pause token still freezes all snake motion for five seconds. Seven guaranteed starter workers and previous starter bonuses remain intact; an amber token follows them. The subsequent [barrel balance correction](BARREL_BALANCE_ITERATION.md) sets worker drops to 50%, bombs to 15% and divides the remaining 35% equally among rewind, pause and slowdown. It replaces the third starter coin outcome with plain rewind and removes all barrel coin awards.

Tapping a belt/stored token or dropping it onto valid field consumes it once. It uses the same source ownership/reservation gate as rewind and pause, survives the belt exit while held, and can occupy any purchased bonus stand. Invalid drops return it safely.

At each activation, 20% of the current underlying forward speed is added to a persistent subtraction from the original active-time speed curve. It does not multiply acceleration or reset the difficulty clock. With reductions R, speed is max(0.034, baseCurve(t) − R); the floor is 10% of starting speed 0.34. Reduction is limited at activation to leave that positive floor, so rapid repeated tokens near the floor may reduce less than 20%. Acceleration keeps increasing at the existing rate immediately afterward, including after reaching the floor. Rewind, magnetic gap pulls and recoil retain their existing motion rules. During pause or rewind, the token reduces underlying forward speed, not zero/negative observed head velocity. Global pause and terminal game-over reject bonus use. Restart clears accumulated reductions.

The existing speed curve remains 0.34 + 0.00125 × t × (1 + 0.15 × t), with only its preexisting remote numeric safety guards. The new subtraction does not introduce a playable speed cap.

## Disposal

An orange-rimmed dark hole labelled DISCARD WORKERS sits beside the rightmost storage stand, clear of the conveyor rail (field position x=3.05, z=6.6, radius=0.42). Drag and release a worker inside the actual hole to remove it, without coins, merge progress or refunds. It accepts every worker level and both pad/belt sources. Removing a deployed highest-level worker naturally lowers the next worker-barrel range and upgrade cap.

Disposal requires a valid owned drag and reserved empty source. Mining state is reset when lifted and discarded; source reservation and drag state clear together. A tap, drag cancellation, lost capture, global pause or invalid release never deletes the worker. Bombs, rewind, pause and slowdown dropped in the pit return to source rather than activating. Pit hit-testing uses its physical hole only, not the forgiving pickup halo. UI always takes priority; the hole takes priority over neighboring storage screen-space margins, never their physical stand footprint. The pit itself has no click action. A release without an intervening move sample now starts a pad worker drag before resolving its drop, as belt pickups already did.

## Pickup

The pickup-only radius grows from 24 to 34 screen pixels. All eligible object kinds use the expanded radius. Existing entity and empty pad/storage core targets are chosen by nearest projected center first; additional pickup halos are considered only when no core target applies. Empty conveyor slots are a final fallback. UI and the disposal hole do not pick nearby objects. Drop target sizes do not grow, protecting deliberate merge, storage and discard destinations.

## Verification and publishing

Only source inspection, Vite bundling and the existing standalone packaging script are authorized this iteration. No tests, TypeScript typecheck, browser launch or device QA is performed. The packager retains its normal embedded-JavaScript syntax and dependency checks. Gameplay and visual QA remain with the owner.

The worker-drop upgrade cap, 0.00125/0.15 acceleration coefficients, magnetic motion, pause duration, rewind target, mining speeds and held-item ownership policy remain unchanged. No network asset, new dependency, Site creation, user-computer access or direct Git push is part of this change.
