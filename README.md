# Graveyard Shift

A browser-based 3D mining and worker-merge game built with Three.js and TypeScript. The repository retains its original name, **RockSnakePlayableTest**; the current game is **Graveyard Shift — Undead Mining Co.**

**[Play the current public build](https://graveyardshift.pearly-haven-3558.chatgpt.site)**

The source repository is private. The hosted game supports portrait and landscape layouts with mouse and touch controls.

## Start and play

- Press **PLAY** on the logo screen. No intro video plays before that click.
- The intro selects the portrait or landscape MP4 for the current viewport and plays at 2× speed, followed by a short zoom-out into the game. If playback fails, a **Start game** fallback is available. Browser audio restrictions may require another tap.
- Keep the accelerating rock snake from reaching **FINISH**. Skeleton miners and bombs destroy rocks, earn coins, and create gaps that pull the front of the chain backward.
- Tap barrels on the conveyor to reveal workers or bonuses. Drag workers onto work pads; merge matching levels to create stronger miners. Dropping a worker onto an affordable locked pad buys and occupies it.
- Items left on the conveyor eventually leave through its exit tunnel. Held items remain safe during a drag; invalid drops return them to their source.
- Drag unwanted workers into the **Income +20% discard pit**: each discarded worker adds 20% to current rock-coin income for the rest of the run. The wallet shows the current multiplier.

### Bonuses and progression

After the fixed starter sequence, barrels reveal workers 50% of the time. Six bonuses share the remaining 50% equally:

- **Bomb:** drag onto the rock chain for an area explosion.
- **Rewind:** move the head back toward the first bend without resetting its speed or moving an already-earlier head forward.
- **Snake pause:** freeze snake motion and its acceleration clock for five seconds; miners and the conveyor continue.
- **20% slowdown:** permanently reduce current forward speed, subject to its configured minimum.
- **50% slowdown:** permanently halve current forward speed, including below the usual minimum.
- **Tail-half blast:** destroy half the current rocks from the tail, rounded up, with normal rewards.

Non-bomb bonuses can be tapped or dragged onto the field. Purchase bonus storage stands for **50 / 150 / 300 coins**; each holds one bonus until used. Worker-drop upgrades start at **50 coins** and rise 20% per purchase: **50 → 60 → 72 → 87** (ceil(50 × 1.2^paidUpgrades)). The upper worker level is 1 plus purchased upgrades; the lower level is max(1, upper − 2). Reveals roll within that range, favoring lower levels. For example, upper level 13 gives levels 11–13. Deployed workers never change this range. Placement and merging never raise future barrel levels automatically. Existing workers are unchanged by purchases and level up only through merging. The button abbreviates prices with K/M/B/T; its tooltip and purchases use the exact whole-coin cost.

The HUD provides **Pause/Resume**, **Restart**, **Help**, and separate **Sounds / Music** settings. Audio preferences are saved locally when browser storage is available. Music continues from the intro into gameplay; procedural effects cover mining, explosions, bonuses, worker actions and UI feedback. Restart resets the run's progression.

## Run locally

Use **Node.js 24.19.0** and **npm 11.9.0**, as pinned in `.nvmrc` and `package.json`. A modern browser with WebGL 2 support is required.

Clone the private repository with an account that has access, then run:

```sh
git clone https://github.com/IliaMerkurev/RockSnakePlayableTest.git
cd RockSnakePlayableTest
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. These commands work in Windows PowerShell as well as macOS/Linux terminals; no Bash-specific setup is required. If Node or npm is not found on Windows, install the pinned toolchain and reopen the terminal.

## Build and preview the export

```sh
npm run build:playable
npm run check:budget
npm run preview:playable
```

Open **http://127.0.0.1:4173**. Serve the export over HTTP rather than opening it with a `file://` URL.

The complete playable package is:

```text
dist/playable/
  index.html
  media/
    intro-portrait.mp4
    intro-landscape.mp4
```

`build:playable` runs TypeScript checking, builds with Vite, inlines application JavaScript/CSS and assets into the HTML, validates the embedded script, and copies both intro videos. The skeleton model, logo and music are embedded; the two orientation videos remain separate same-origin files. Keep their relative paths when hosting or sharing the package.

**The hard size limit is strictly below 5,000,000 bytes for `index.html` alone.** External intro videos are explicitly outside that limit. The last functional build published on 2026-10-16 (Site version 50) has a **4,991,877-byte HTML**, leaving only **8,123 bytes to the threshold**. Both videos together add **8,724,383 bytes**. The budget script reports a warning above its 2 MB target but fails at the 5 MB hard limit.

The export has no external script, stylesheet or font dependency. Its content security policy blocks application network connections while allowing the bundled same-origin video files. There is no backend or ad-network SDK; the playable bridge is browser-local.

## Validation

Available commands:

```sh
npm run typecheck
npm test
npm run test:feedback
npm run test:magnetic
npm run test:e2e
```

For the Playwright suite, install its browser first with `npx playwright install chromium`. Historical production smoke scripts and their prerequisites are documented in [docs/PRODUCTION_QA.md](docs/PRODUCTION_QA.md).

Build/typecheck/budget and targeted checks have been used throughout development. **Do not interpret this as a current full-suite pass:** some legacy tests contain outdated renderer mocks, DOM assumptions or hint expectations. Historical reports describe their own checkpoints, not the complete current game. The latest logo/HUD/English-label build passed typecheck and build/budget checks; a fresh comprehensive browser or physical-phone regression pass was not performed for that final revision.

## Source layout

- `src/game/`: deterministic state, simulation, commands, progression and balance configuration
- `src/render/`: scene/layout, animated skeleton workers, tactile motion, particles and stone debris
- `src/render/dungeon/`: procedural dungeon geometry, materials and texture atlas
- `src/audio/`: procedural effects, music playback and saved audio preferences
- `src/input/`: mouse/touch Pointer Events interaction
- `src/ui/`: start screen/video transition, HUD and audio controls
- `src/assets/`: skeleton GLB, music MP3 and logo WebP embedded at build time
- `public/media/`: external portrait and landscape intro videos
- `scripts/`: build/export, size checks, preview server and development utilities
- `art/dungeon/`: development model kit, manifest and export documentation
- `tests/`: development-only unit and browser tests
- `docs/`: rules, decisions and historical iteration/QA reports

See [v0.4 rules](docs/RULES_V04.md), [storage and upgrades](docs/STORAGE_UPGRADE_ITERATION.md), and [dungeon kit notes](art/dungeon/README.md) for focused implementation context. Older task and iteration documents are historical and may describe superseded behavior.

## Repository workflow and assets

The latest prototype was merged into `main`. Use the owner's requested branch workflow for subsequent changes; direct changes to `main` require explicit approval. Never force-push or bypass repository protections. Verify the remote commit after publication.

The repository includes supplied and generated art/audio assets. No repository-wide license file is currently present; this README does not grant redistribution rights to the source or bundled media.

### Mobile soundtrack playback

The embedded MP3 is decoded once into a looping Web Audio buffer, avoiding competition between separate HTML audio and video players during the intro. PLAY resumes the music context synchronously, before waiting for decoding; the same source continues through transitions, gameplay pauses and restarts. Music muting changes its gain without restarting the timeline. Hiding the page suspends its context; returning resumes it. Saved Music/Sounds preferences remain independent.

Music uses one dedicated AudioContext in addition to the existing SFX context, so gameplay/SFX pause gates cannot interrupt the soundtrack. It requests the original 32 kHz sample rate, with a device-default fallback. The 111.096-second stereo PCM buffer is approximately 28.4 MB at 32 kHz or 42.7 MB at 48 kHz, excluding browser overhead; it is reused, not decoded per play or restart. Destruction stops/disconnects the source and closes the context. Browsers without Web Audio retain the HTML audio fallback. This compatibility change has focused lifecycle/unit coverage; actual Xiaomi/iPhone playback still requires device verification.

### Optional live onboarding (prototype/0.5)

The first worker barrel starts at the center of the moving conveyor, with no barrels ahead. Rewind and bomb barrels follow behind. The original level-1 miner remains on the first pad; starting money, mining balance, and paid upgrade prices are unchanged.

A pointer-transparent arrow follows real targets: tap a worker barrel, drag a matching worker to merge, reveal/tap rewind, reveal/drag a bomb onto rocks, buy an affordable WORKER DROP upgrade, then buy an affordable work pad and bonus pocket, store a bonus, and use it from the pocket. Purchase arrows recheck affordability each frame. An already filled pocket leads directly to using its bonus. Any completed action counts even when performed out of order. Missing essentials return in normal incoming barrels while their lesson remains incomplete; the belt and game never pause for the guide. Worker recovery respects the current random paid reveal range and looks for actual matching pairs; missing storage bonuses return on normal incoming barrels. Arrows hide during drags, pause, game over, intro and the audio menu; reduced-motion mode uses a static cue. Completion including storage is remembered in local storage when available; the older completion marker does not skip the expanded guide. Help → Restart with guide clears that preference and restarts the run.

Only equal-level workers merge. Different-level workers on occupied work pads can swap places in either direction. Dropping a conveyor worker onto an occupied pad with a different-level worker is rejected and restores the dragged worker safely. Swapping neither removes workers nor raises income. Manually drag a field worker into the pit to free its pad; a new worker can then occupy it.

After the merge, rewind and bomb lessons (or for players with a saved completed guide), an optional “SWAP” cue points from a stronger worker on a later work pad to the worker on the first pad. It rechecks live workers and hides during drags or when either worker becomes unavailable. Only a successful swap bringing a stronger later-pad worker onto the first pad completes the lesson. Completion is saved independently; previously completed guides still receive it. The swap cue takes priority over the discard cue, so only one arrow is shown. Restart with guide resets the swap lesson too.

After the same core lessons, a separate optional live cue appears when every unlocked work pad is occupied by a worker and a visible, revealed conveyor worker is strictly stronger than the weakest field worker. It points from the lowest-level field worker to the pit, labeled “Income +20%”. Locked pads do not block it. Equal or weaker conveyor workers, closed barrels, bonuses, held or reserved workers do not qualify. The cue rechecks occupancy and the weakest worker each frame, hiding when no stronger conveyor worker remains or an unlocked pad becomes empty and retargeting when workers move or merge. It never points from the conveyor. Only a successful manual discard from a work pad completes this lesson; conveyor discards still increase income but do not complete the field lesson. Existing players who completed either the earlier guide or conveyor-discard lesson receive this new cue too. Field-lesson completion is saved separately when browser storage is available; Restart with guide resets both the main guide and field lesson. The cue never pauses play or forces a discard.

### Discard income

Income starts at ×1. Every successful manual worker discard from a work pad or conveyor multiplies it by 1.2 for the current run: ×1 → ×1.2 → ×1.44. Monetary values remain Numbers with numeric safety limits. Income and upgrade pricing are independent: discards never change upgrade, pad or pocket prices; paid upgrades never change income. Mining, bombs and tail-half blast use the multiplier for destroyed-rock rewards; bonus odds and kinds are unchanged. Fractional rock rewards carry forward into later whole-coin payouts. Discarding itself pays no coins. Swaps, equal-level merges, rejected drops, cancellations and conveyor exits do not increase income. Restart resets income to ×1 and the next worker upgrade to 50 coins. The pit shows a coin and up arrow with “Income +20%”; successful manual discards show “Income +20% · ×current multiplier”. The wallet abbreviates large coin totals and displays multipliers to two decimal places; tooltips retain the stored values.

### Touch zoom and fullscreen
The game shell uses touch-action: manipulation to suppress accidental double-tap zoom. The canvas allows pinch zoom while retaining one-finger drag handling; scrolling help also allows pinch zoom. No maximum-scale or user-scalable=no restriction is set. The fullscreen button requests document fullscreen directly from a click and reflects entry/exit events; rejected/unsupported requests show a visible fallback without interrupting gameplay. Standard APIs are preferred, with capability-gated WebKit element fullscreen as a fallback. This depends on browser and embedding permissions. Safari on iPhone may not offer element fullscreen; use Share → Add to Home Screen → Open as Web App when available. The existing resize handler cancels active drag, clears coin transfers and relays out the scene after viewport changes. No physical-device Safari QA was performed.

### Bonus explanations
Each of the six bonus types gets a seven-second, input-transparent action chip on its first barrel reveal. The short chip follows the revealed bonus with a pointer, flips below when needed and clamps to the viewport, avoiding HUD controls and the live tutorial label where space permits. Removed or consumed targets are dequeued; offscreen targets hide the card. Only one card is shown at a time; duplicate reveals are coalesced. Dragging, pause, Help, audio settings and game over hide the card and suspend its timer. Seen types persist when storage is available; ordinary restart keeps them, while Restart with guide resets them. Help lists all six effects at any time, including permanent speed reductions with continuing acceleration and the tail blast’s waiting front. No bonus probabilities or effects change. Shader packaging removes only horizontal whitespace around punctuation, retaining all GLSL tokens, newlines and preprocessor directives; assets are unchanged.

The pre-PLAY screen offers the same capability-aware fullscreen control and four compact icon rules plus a six-bonus icon legend, reusing the in-game effect-chip labels. Unsupported fullscreen feedback stays on this screen. Fullscreen does not start the intro, music or gameplay; PLAY remains the explicit launch gesture. Intro fullscreen listeners are removed on launch.

The start-screen bonus legend is visually separated from the basic rules by an extra gap.
