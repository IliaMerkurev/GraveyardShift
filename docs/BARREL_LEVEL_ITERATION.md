# Progressive worker barrel levels — prototype/0.2

Owner feedback on 2026-10-13: occasionally reveal stronger workers as the workers placed on the map progress; stop revealing the earliest levels once progression is far enough ahead (highest level 13 allows levels 3–12).

- At the moment a worker barrel opens, find the highest-level worker actually occupying an unlocked work pad. Both the pad's occupant and the worker's location must match. Belt workers, held workers, reserved pads and stale references do not count. This is current placement, not the highest level ever reached or the state when the barrel spawned.
- Allowed levels are `low…high`, where `low = max(1, highestPadLevel - 10)` and `high = max(1, highestPadLevel - 1)`. No occupied pads, or a highest level of 1–2, yields level 1. Highest level 5 allows 1–4; level 6 allows 1–5; level 13 allows 3–12; level 14 allows 4–13. The window contains at most ten levels and shifts down again if the current highest worker is picked up or moved off the pads.
- Use the simulation's existing seeded RNG: `N = high - low + 1`, then `level = min(high, low + floor(N × u²))`, with `u` in `[0, 1)`. The ideal probability of the `k`th level in the window is `sqrt(k/N) - sqrt((k-1)/N)`. For levels 1–4 this is approximately 50%, 20.7%, 15.9%, 13.4%. In a ten-level window the lowest level has about 31.6% probability and the highest about 5.1%; every allowed level remains reachable. Sampling uses constant-time arithmetic, with no array or loop proportional to the level. The existing safe-integer representation guard remains in place.
- The level is rolled once after a valid worker-barrel opening. Level-1-only openings and invalid/repeated openings consume no additional RNG. New rolls remain reproducible for the same seed and command sequence; they share the existing RNG stream, so later barrel-kind rolls may differ, but their configured weights and starter kinds are unchanged.
- The revealed worker keeps the barrel's unique ID and moving carrier, starts with a fresh mining cycle, and uses the existing actual-level helmet color and numeric label. Merge progression, attack progression, economy, other loot, bonuses and snake behavior are unchanged.

## Delivery scope

Only direct Vite bundling and standalone packaging are run, per the owner's manual-testing instruction. No tests, typecheck, browser QA or Dreambook work. The packager's inherent syntax and external-reference checks are packaging checks, not gameplay verification.
