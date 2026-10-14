# Portrait framing and compact hints — prototype/0.3

Owner feedback, 2026-10-13: text obscures the conveyor in portrait; keep brief guidance only once or twice and bring the portrait camera closer.

- Reviewed the supplied cropped screenshot: the two-line upgrade-success toast directly covered the storage/conveyor. Removed that redundant toast; the button remains the source for current worker levels and next upgrade price.
- Portrait has a reserved top HUD/message strip outside the canvas. Remaining messages use a compact 30px row, 2.4-second duration and shorter text. Two automatic onboarding actions per run replace persistent tutorial and belt-exit text. Repeated action guidance is limited to twice per type per run; invalid-action feedback remains available. Help retains the full rules.
- Kept numeric worker level badges, pad and storage prices, finish/discard markers and live pause countdown. The countdown still uses the reserved bottom rail.
- Portrait camera fits explicit playable bounds with perspective-aware corner constraints, a forward-shifted aim and 12px minimum edge allowance. It excludes decorative floor from the fit and shortens that floor. The full route, finish, pit, storage and conveyor are included. Labels and input share the canvas inset. Orientation follows shell dimensions, so a shortened portrait canvas cannot accidentally rotate the level.
- Landscape camera formula and scene/floor transforms are unchanged; compact HUD guidance also replaces persistent wording there.

Delivery: source inspection and direct Vite/standalone packaging only before publication, per the latest requested order. Parent coordinates bounded checks after the updated Site is shared. No test/typecheck/browser/device checks claimed here.

Canonical base: 1208a1281aec10e05872c9ad33b6ce039db61942. Local base: 69b8f5b81b89bb21f2221b5d4922e4c158f04f3a. Publish the frozen delta onto canonical prototype/0.3 rather than pushing divergent local history. No main edits in this package.

## Bounded layout correction after v17 screenshots

Reviewed 844×390, 390×844 and 320×568 captures. The landscape guidance strip crossed the discard marker; the compact portrait discard wording touched the right storage price; the decorative HEAD badge crossed a pad price.

- Automatic guidance is now hidden in landscape. Wider landscape action/error feedback uses the empty header gap, outside the field; very narrow landscape suppresses the strip entirely.
- Portrait discard wording is anchored to the right of its pit with a canvas-edge clamp, separating it from the storage prices.
- Removed the decorative HEAD badge from view; the snake itself and FINISH remain visible. Numeric worker levels, pad/storage prices and pause timer are unchanged.
- No camera, motion, economy or input change in this correction. Parent owns the single targeted layout recheck.

## Current storage/conveyor composition

The owner rejected both the v18 crowded right column and the v19 side bay. Their annotated reference explicitly requests a lower conveyor and a single row of three storage pockets plus the pit directly above it. The current landscape follows that reference: centered mining field, storage/pit row at z4.7, then conveyor at z6.65. The right-hand bay is removed. Portrait keeps its existing row-above-belt composition.

Landscape camera distance and FOV stay unchanged. Its target moves to z2.2 to frame the lower stack. The bottom rail shrinks from 94px to 64px, retaining a 44px upgrade button and help target; the active pause countdown occupies the empty top-HUD center. The floor now extends beneath the lowered belt. Explicit view mapping and inverse field rays remain shared across meshes, hits/drops, indicators and effects. All three belt consumers use the same beltZ constant. Game-state positions and economic rules are unchanged.

Source/math review: at 844×390 (326px canvas), the front belt rail remains about 9px above the canvas bottom; at the 1180×720 shell (656px canvas), about 17px. Storage centers are roughly 80px apart in the smaller landscape. Prices remain below their stands, occupied bonuses have no redundant STORED caption, and the pit uses a small trash-can glyph. These are projection checks, not visual acceptance.

Current QA: prior v18/v19 interaction checks passed pickup, merge targets/clear, storage buy-by-drag/extraction/cancellation, pit deletion, bomb targeting/shake, upgrade bounce/purchase/no repeated toast, and no JavaScript errors. Those versions were rejected visually. The current correction passes seven targeted mapping tests, including the lower belt's placement and bonus-drop exclusion, plus typecheck. Parent will publish first, then run only the new layout and affected storage/pit/conveyor/field input recheck. No current browser-layout pass is claimed yet.
