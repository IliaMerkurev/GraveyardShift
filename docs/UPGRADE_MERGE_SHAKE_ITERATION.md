# Upgrade bounce, merge targets and bomb shake — prototype/0.2

Owner requests, 2026-10-13: visibly bounce the hero-level upgrade button when an upgrade is possible; highlight every worker that can merge with the held character; add camera shake on explosion.

## Feedback

- The existing HUD purchase gate controls a repeating double bounce (7px jump, small squash/stretch, 1.35-second cycle). It requires enough coins, an effective range increase, a valid price, no active drag, no pause and no game over. It uses a dedicated animation, leaving tutorial pulses unchanged. Reduced-motion preference keeps a strong static outline/glow.
- During worker drag, all same-level workers on pads and conveyor slots get a green ring/glow, green level badge and MERGE label. Each candidate must actually occupy its destination, must not be held or reserved, and must pass the live `Game.canDrop` command. Empty places and different-level workers are not merge targets.
- The target set and screen positions update every rendered frame, so moving/recycling belt slots stay current. The normal hovered valid/invalid ring and bonus/discard affordances stay separate. Drag completion, cancellation, pause, restart and game over clear merge styling; merge/drop also clear it synchronously through pointer cleanup.
- Successful bomb events trigger a bounded 280ms shake with quadratic decay. The camera offset is rebuilt from its settled pose each frame, so repeated explosions cannot accumulate drift. Projection, labels, hit/drop detection and rendering all use that camera. Resize/restart reset it; pause/game over and reduced-motion preference cancel it. No damage/economy or snake-motion behavior changes.

## Delivery scope

Source review plus direct `npx vite build` and `node scripts/build-single.mjs` only. No tests, typecheck, browser QA or device QA, as requested. The standalone packager retains its built-in embedded JavaScript syntax and external-reference checks. Visual feel and gameplay are for the owner's manual review.

Canonical parent: 30c13079e231a7251c1a0bb9bbc714226c172111. Local base: 2a6ff0439499edbbac7b312d22abdcd9af1b5347. Baseline tree: 949bd9edffb98074e5ec5958d5c9c0747766639f. Publish only the frozen delta to prototype/0.2, without pushing divergent local history or touching main.
