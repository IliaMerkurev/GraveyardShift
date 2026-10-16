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
- Drag unwanted workers into the **DISCARD WORKERS** pit to remove them without a coin reward.

### Bonuses and progression

After the fixed starter sequence, barrels reveal workers 50% of the time. Six bonuses share the remaining 50% equally:

- **Bomb:** drag onto the rock chain for an area explosion.
- **Rewind:** move the head back toward the first bend without resetting its speed or moving an already-earlier head forward.
- **Snake pause:** freeze snake motion and its acceleration clock for five seconds; miners and the conveyor continue.
- **20% slowdown:** permanently reduce current forward speed, subject to its configured minimum.
- **50% slowdown:** permanently halve current forward speed, including below the usual minimum.
- **Tail-half blast:** destroy half the current rocks from the tail, rounded up, with normal rewards.

Non-bomb bonuses can be tapped or dragged onto the field. Purchase bonus storage stands for **50 / 150 / 300 coins**; each holds one bonus until used. Worker-drop upgrades start at **50 coins** and double in price, raising future barrel levels up to the highest worker currently deployed on a pad. Merge and deploy stronger workers to raise that cap.

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
