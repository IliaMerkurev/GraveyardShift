# Prototype 0.4: two additional bonuses

- Preserve the approved prototype 0.3 storage-row layout.
- Green **↓50%** permanently subtracts half the current underlying forward speed. It can go below the old 10%-of-starting-speed floor. Future acceleration retains its original slope. Pause and rewind do not prevent applying this reduction. The existing amber 20% brake remains and never raises an already-subfloor speed.
- Red **tail-half blast** destroys `ceil(current stone count / 2)` stones, ordered from tail toward head. Each destroyed stone grants its ordinary reward once. An odd count rounds the destroyed half up; a one-stone snake is cleared and resumes entrance generation.
- Every surviving front stone keeps its logical position and visible recoil pose. New rear stones enter at the entrance and travel toward the held front; there is no instant backfill of the removed half. Contact releases the hold. Mining/bombs can remove held stones without moving other survivors; normal gap recovery resumes after release.
- Snake pause freezes incoming rear motion and acceleration, preserving held poses. Global pause freezes everything. Rewind clears the tail hold immediately, including a no-op rewind or rewind queued during snake pause. A newer tail blast supersedes an active/queued rewind and establishes a new hold.
- Both new bonuses support tap activation, field drag, purchased storage, safe cancellation, invalid-drop return and held-item ownership.
- After the fixed introductory sequence: workers 50%; bomb, rewind, five-second pause, 20% brake, 50% slowdown and tail-half blast each `50% / 6` (8⅓%). Every barrel contains an item; there are no empty/coin-only reveals.

## Validation scope
Focused new-mechanics and pointer tests, selected existing pause/rewind/brake/ownership/probability integrations, typecheck and standalone build/budget. No full legacy regression suite or physical-device/browser claim is made for this iteration.
