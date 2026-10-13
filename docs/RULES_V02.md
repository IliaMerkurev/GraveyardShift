# Owner-approved prototype/0.2 rules — 2026-10-13

Latest barrel authority: [Barrel reward balance](BARREL_BALANCE_ITERATION.md) removes every barrel coin grant and coin outcome; random drops are worker 50%, bomb 15%, and each of rewind/pause/permanent slowdown 35% / 3. Earlier coin-barrel descriptions are historical.

Latest motion authority: [Full snake pause and rewind near the first bend](PAUSE_REWIND_ITERATION.md) supersedes all earlier slow/rewind behavior and acceleration values below.


These later instructions supersede the conflicting v0.1 infinite-flow, permanent-gap, belt-stop and continuation rules. Primitive Three.js art, rigid individual stones, shared worker geometry, pointer/touch input and standalone export limits remain unchanged. Visual production comes later.

## Current playtest corrections

[Capped, visible worker upgrades](UPGRADE_CAP_ITERATION.md) caps both ends of the paid worker-drop range at the highest currently deployed worker (level 1 fallback). Purchases are blocked without charge when neither endpoint can improve. The upgrade control now occupies a dedicated high-contrast bottom rail outside the game canvas.

[Bonus storage and additive worker-drop upgrades](STORAGE_UPGRADE_ITERATION.md) adds three permanent bonus slots per run and a coin-funded +1 drop-level button whose price doubles. It supplements the dynamic drop window below. Owner performs manual gameplay testing; only bundling/standalone packaging run for this iteration.

[Progressive worker barrel levels](BARREL_LEVEL_ITERATION.md) samples from a sliding window of up to ten levels below the highest worker currently placed on a work pad, favoring the lower end. A maximum of 5 allows 1–4; a maximum of 13 allows 3–12. Empty pads or a maximum of 1–2 still yield level 1.

[Worker attack-speed progression](ATTACK_SPEED_ITERATION.md) adds faster swings starting at level 3; other current rules remain unchanged.

The latest [barrel and bonus-drag correction](BONUS_DRAG_ITERATION.md) supersedes coin-only disappearance, tap-only bonuses, and prior acceleration tuning. The owner now tests manually: do not run automated tests, typecheck, browser QA, or Dreambook work for this iteration.

The latest [magnetic-motion correction](MAGNETIC_ITERATION.md) supersedes gap pauses, rear anchoring and acceleration caps in all earlier descriptions.

The six later feedback corrections in [FEEDBACK_ITERATION.md](FEEDBACK_ITERATION.md) supersede the historical implementation below, particularly instant gap/rewind motion, slow acceleration, held-item expiry, and empty carrier visuals.

## Prior implementation (historical; see corrections above)

- Head starts at exactly 50% of the path with 65 contiguous links behind it. The final half is empty; the head progresses gradually. Tail supply enters only behind the chain at the track entrance. Reaching FINISH triggers one terminal game-over event, freezes gameplay, and presents Restart without a continuation/CTA/navigation. Level-3/pad achievement is now a non-pausing milestone toast.
- Destroyed links shift every surviving link in front of them backward by one spacing. The rear stays fixed. Pickaxe and bomb use the same reward/removal gate. Bomb victim IDs are captured before any shift, avoiding damage to new stones pulled into the blast after removal. Removal is atomic; meshes remain rigid.
- Matching workers merge beyond level 5 with no gameplay rejection ceiling: 5+5→6, 6+6→7, and so on. The first five damage values remain tuned; each subsequent level doubles damage. Helmet geometry stays shared; first-five colors stay unchanged, later levels receive deterministic finite colors and retain numeric level labels. To prevent floating-point corruption, level and damage saturate at `Number.MAX_SAFE_INTEGER`; matching merges remain accepted at that unreachable practical guard rather than wrapping/producing NaN or Infinity. This is a machine representation limit, not a level-five gameplay cap.
- No empty barrel outcome exists in the previous model. Keep its useful worker/coin/bomb rewards and add a real cyan rewind token rather than guessing which consumed barrel or empty carrier the feedback called empty. A barrel reveals the token; tapping the token consumes it. An empty carrier remains a visibly empty carrier. The seventh deterministic starter barrel introduces rewind after the first carrier exits.
- Rewind translates all surviving links together. If the head is at/after midpoint, move it back to midpoint. If before midpoint, move it near the first miner (`rewindNearStart=0.8` path units), never forward when already earlier. IDs, HP, resources, removed rocks, earned rewards and difficulty time are unchanged. Tail links shifted before the entrance retain negative path coordinates, remain invisible and untargetable, and enter naturally; they are neither piled at the entrance nor resurrected.
- A distinct purple clock token slows only snake movement to 0.5× for five active seconds, with smooth recovery during the final 0.5 seconds. Belt, mining swings, rewards and active difficulty time remain normal. Repeated pickups refresh the duration, never multiply strength or extend beyond five seconds. Global pause freezes its visible countdown; Restart clears it. The eighth starter barrel introduces this bonus.
- Speed increases smoothly with active simulation time: `min(0.68, 0.34 + 0.0028 * activeSeconds)` path units/second. Values are prototype tuning constants. Help/tab-hidden pause does not age difficulty or replay missed time. Rewind does not reset speed; Restart resets the complete run. An untouched simulation currently loses at 42.35 active seconds, not a forced timer.
- Belt carriers move continuously during active gameplay, including full load and dragging. Anything reaching the left exit is deleted without reward; the carrier wraps and can bring a new barrel at the right entrance. When a belt-origin drag expires, delete the dragged entity, release its reservation, clear the gesture/pointer capture/highlights, and ignore late pointer-up. A pad-origin drag does not expire with unrelated belt carriers. Cancel/invalid drop returns to the current moving source only before expiry. Help/tab-hidden/game-over remain global pauses.

## Verification scope requested by owner

Only new and directly affected scenarios are tested this iteration. `npm run test:v02` selects the new model (including snake-only slow), pointer and primitive cases, leaving prior coverage unexecuted. Seven obsolete unit cases for permanent gaps/no defeat/belt stopping/max-level rejection were replaced by the v0.2 suite; the old initial-count assertion was updated. Historical full v0.1 results remain historical, not claims for this build. The old broad E2E/smoke scripts also describe v0.1; use the bounded new-rule script in `docs/QA_V02.md` for this iteration.

Typecheck, build, embedded JavaScript syntax and static budget validation still apply to the new artifact. No browser is launched in the cloud container; the parent coordinates bounded Dreambook QA with already-installed official tooling, and owns deployment to the existing Site. No new Site, external asset, analytics, permission changes or CSP relaxation is introduced.

## Source control

Canonical remote base: `67229de8d57221becf8c78f688a277e41c55c45f`, tree `8af9912667588731e936d24b0cd55dd9cdefccaa`. Local prior metadata is backed up as `backup/prototype-0.1-before-0.2`; local `prototype/0.2` has identical baseline content. The publisher must commit the supplied delta against the canonical parent through its authorized GitHub connector. No main push, merge, force-push, default-setting change or destructive reset is authorized here.

## Permanent slowdown, worker disposal and forgiving pickup

[Permanent slowdown, discard pit and pickup halos](SLOWDOWN_DISCARD_PICKUP_ITERATION.md) adds an amber permanent speed-reduction bonus alongside the existing purple five-second full pause, a worker-only disposal pit and larger pickup-only regions. Acceleration coefficients, magnetic motion and currently deployed worker upgrade cap remain unchanged. This iteration is source-reviewed and packaged only: no tests, typecheck, browser or device QA.
