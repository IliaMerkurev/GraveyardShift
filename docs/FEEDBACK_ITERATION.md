# Playtest feedback iteration — prototype/0.2

This iteration supersedes conflicting instant-motion, held-expiry and empty-carrier rules in earlier reports. It does not change primitive art direction or introduce a new Site.

## Visible difficulty

Forward speed is `min(0.85, 0.34 + 0.017 * activeSeconds)` path units/s. At 10 seconds it is 0.51 (1.5× starting speed), at 20 seconds 0.68 (2×), and at 30 seconds it caps at 0.85 (2.5×). The previous increment, 0.0028/s, took roughly two minutes to double and was too subtle for a short playable. These are tuning constants, not a scripted loss timer. Global pause stops active time; slow, closure and rewind do not reset difficulty. Actual forward progress is interrupted by destruction and bonuses.

## Destruction, gap closure and rewind

- Removal and reward remain immediate and exactly once. Explosion particles identify the destroyed location; surviving rocks do not teleport.
- An interior gap freezes chain advancement for 0.35 active seconds, within the requested 0.25–0.5 second range. The surviving rear section remains an anchor. After the delay, contiguous sections ahead of gaps slide backward at 1.2 path units/s, clamped to contact. Every section is rigid; no link overlaps or crosses another. Forward motion resumes only when every gap is connected.
- Multiple gaps are resolved rear-to-front without distance snaps. Each new independent gap has its own 0.35-second delay; unrelated gaps continue closing. Expanding an existing gap preserves its original deadline, so staggered or repeated kills cannot indefinitely postpone retraction. Positions and already-paid rewards are preserved. Removing an extreme head/tail without creating an interior gap requires no fake closure movement.
- A cyan rewind token starts a 1.2-active-second whole-chain backward translation. The destination stays the existing midpoint, or 0.8 path units near the first miner if the head is before midpoint. Activation does not alter positions. Each step moves all surviving links equally; negative-distance tail links stay offscreen. IDs, HP and rewards are preserved. Repeating rewind retargets smoothly from the current positions.
- Existing gaps are preserved during rewind and close afterward; their explosion deadlines use active time and do not restart after rewind. Mining/bombs can still remove rocks through their one-reward gate. Head destruction cannot make rewind push survivors forward. No tail spawn occurs while rewind/closure is in progress.
- The purple slow bonus remains snake-only: it scales forward movement and gap retraction, not belt or mining. Explicit rewind keeps its 1.2-second travel time. Pause freezes animations; Restart clears them.

## Conveyor ownership and purchase

A revealed worker/bomb becomes gesture-owned on pointer-down and remains held across source-carrier wraps. The reserved source is an empty moving return position; it cannot spawn a second item while reserved. Other carriers continue running/refilling. Invalid drop, cancellation, lost capture or pause restores the item to that carrier at its current position. After restoration it is again an ordinary belt item and may eventually exit; a held item never expires. Taps return safely without a drop, and late repeated pointer-up does not duplicate actions.

A worker dropped on an empty affordable locked pad buys it and occupies it in one command. Hover/canDrop is read-only. Purchase/coin deduction happen once on valid drop only; insufficient funds or a bomb does not buy the pad and returns the item safely. Click purchase remains supported.

## No empty-barrel visuals

Every unopened barrel retains an actual reward. Workers/bombs/bonus tokens replace their barrel; coin barrels immediately grant +50 and remove the barrel. Consumed entities are removed. Empty or reserved belt positions no longer draw a solid carrier/container; an empty-slot plus is shown only during drag as a drop target. Coin openings receive explicit visible reward feedback so disappearance cannot be mistaken for an empty reward.

## Evidence and delivery

Run only new/changed unit scenarios, typecheck, build, HTML inline syntax and budget. Browser evidence is collected separately with `scripts/production-feedback-smoke.mjs` on the updated existing public Site. Read-only DOM attributes mirror actual simulation positions and projected target centers; they expose no state mutation or controls. The browser script samples animations and records frames, not just their final positions. No old broad suite/soak is part of this iteration.
