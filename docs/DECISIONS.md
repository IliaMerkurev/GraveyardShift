# Decisions and assumptions — v0.1

## Authority and scope

`DOTS_TASK_v0.1.md` and `AGENTS.md` remain the supplied authoritative task. This file records implementation choices and later explicit approvals; it is not a replacement specification.

The actual provided reference is 1080×1350 (4:5), 58.986 seconds. The task deliberately asks for a portrait-first 9:16 composition plus playable landscape. Its branding, zombie models, deforming snake, advertising end card and audio are not copied. The contact sheet is documentation only.

## Later owner approvals

On 2026-10-13 the owner explicitly approved a built-in hosted playable link instead of requiring delivery through the VM browser. After access clarification, the owner explicitly approved **public game hosting**: anyone with the URL may open it, and search-engine secrecy is not guaranteed. Source GitHub repository remains private. Parent task owns publication; source development remains solely on `prototype/0.1`.

The owner separately authorized checking existing Dreambook Git access for the initial branch push. This implementation task does not use the user's computer, create credentials or change security settings. Parent coordinates any transfer/push. No publication is claimed until its remote SHA is verified.

## Prototype rules, not reconstructed reference facts

All numbers are assumptions in `src/game/config.ts`:

- No base health, timed loss, permanent snake death or forced timer end. Rocks flow continuously, leave without reward and replenish only at the entrance.
- Four alternating straight runs and exact arc-length semicircle bends. 156 initial rigid rocks, maximum 200; no mesh deformation. Three resource types, low-poly geometry variants.
- Start at 0 coins with one level-1 worker. Locked pads cost 50, 150 and 300. Resource HP/rewards and level damage are tuning values.
- Six stable conveyor carriers. They really move right-to-left, stop if an occupied carrier reaches the end, and pause/reserve the source during a drag. Uncollected workers/bombs are never silently discarded. Barrels also stop at the end rather than being deleted.
- Starter barrel sequence guarantees workers, a 50-coin bonus and a bomb; later contents use a seeded RNG. No payment or debug button is needed for the first merge/purchase.
- Equal levels merge atomically up to maximum level 5. Different/max-level merges and blocked destinations return to the reserved source. No swap. A destroyed rock has one reward gate shared by mining and bombs.
- Workers retain a living in-range mining target across swings. Damage occurs at the configured strike phase; coins are awarded immediately, visual chips/coins are not a second currency source.
- The tutorial adapts to actual progress. Because the only initial pad is occupied, the first useful drag is a merge; opening a new pad precedes the first empty-pad placement. Other actions remain available.
- Goal is a level-3 worker plus one purchased pad. The goal card lets play continue or restart.
- One fixed-step simulation behind one animation loop. Pauses discard elapsed wall time; restart resets all state without adding listeners or loops.

## Technical choices

Registry metadata and official Vite/Vitest/Playwright documentation checked at setup. Node 24.19.0, npm 11.9.0, Three.js 0.186.1, Vite 8.3.4, TypeScript 7.0.2, Vitest 5.0.4 and Playwright 1.64.0 are pinned. Selected package engines accept this Node version. `package-lock.json` is committed.

Official references: https://vite.dev/guide/ · https://vitest.dev/guide/ · https://playwright.dev/docs/intro · https://threejs.org/docs/

One shared worker body/helmet/tool geometry is reused at every level. Only the helmet material color and separate DOM level badge change. Static worker body pieces are merged by vertex color. Stones, conveyor treads and transient particles are instanced. Walls use one generated 128×128 masonry canvas texture. No external assets or model loaders.

One pointer controller owns a single active pointer, pointer capture, CSS-pixel drag threshold and explicit hit zones relative to the actual canvas rectangle. Touch visual lift does not alter logical drop location. UI is ordinary DOM and never passes its taps to the canvas.

Audio is omitted in v0.1; all feedback is visible. Therefore no audio permission/autoplay dependency exists. State is memory-only; no storage, backend or runtime requests are required.

Build inlines JS/CSS into one HTML, omits development hooks and adds a restrictive content security policy denying network connections. This is a browser prototype, not a validated MRAID/ExitAPI integration or certified advertising asset. CTA shows a local message only.
