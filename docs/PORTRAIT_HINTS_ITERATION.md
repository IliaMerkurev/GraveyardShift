# Portrait framing and compact hints — prototype/0.3

Owner feedback, 2026-10-13: text obscures the conveyor in portrait; keep brief guidance only once or twice and bring the portrait camera closer.

- Reviewed the supplied cropped screenshot: the two-line upgrade-success toast directly covered the storage/conveyor. Removed that redundant toast; the button remains the source for current worker levels and next upgrade price.
- Portrait has a reserved top HUD/message strip outside the canvas. Remaining messages use a compact 30px row, 2.4-second duration and shorter text. Two automatic onboarding actions per run replace persistent tutorial and belt-exit text. Repeated action guidance is limited to twice per type per run; invalid-action feedback remains available. Help retains the full rules.
- Kept numeric worker level badges, pad and storage prices, finish/discard markers and live pause countdown. The countdown still uses the reserved bottom rail.
- Portrait camera fits explicit playable bounds with perspective-aware corner constraints, a forward-shifted aim and 12px minimum edge allowance. It excludes decorative floor from the fit and shortens that floor. The full route, finish, pit, storage and conveyor are included. Labels and input share the canvas inset. Orientation follows shell dimensions, so a shortened portrait canvas cannot accidentally rotate the level.
- Landscape camera formula and scene/floor transforms are unchanged; compact HUD guidance also replaces persistent wording there.

Delivery: source inspection and direct Vite/standalone packaging only before publication, per the latest requested order. Parent coordinates bounded checks after the updated Site is shared. No test/typecheck/browser/device checks claimed here.

Canonical base: 1208a1281aec10e05872c9ad33b6ce039db61942. Local base: 69b8f5b81b89bb21f2221b5d4922e4c158f04f3a. Publish the frozen delta onto canonical prototype/0.3 rather than pushing divergent local history. No main edits in this package.
