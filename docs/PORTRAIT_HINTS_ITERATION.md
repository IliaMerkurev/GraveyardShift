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

## Storage-zone composition correction

The owner rejected v18's crowded vertical storage/FINISH/discard column despite its non-overlap checks. Landscape now has a separate tinted side bay with three horizontal pockets. The pit sits above the bay with a small trash-can glyph, accessible label and tooltip. Storage prices sit below their stands; occupied stands no longer add a redundant STORED caption over their bonus. Portrait keeps its horizontal row and uses the minimal pit icon.

The landscape camera zoom is unchanged. Only the mining field shifts 1.3 world units left to separate it from the bay. View-space mapping and its inverse are shared by field meshes, rocks/workers, input rays, bomb targets and effects. Storage uses explicit stable-ID mapping; naked drag/raycast points never inherit pocket placement. Storage halos choose the nearest candidate. Pit deletion still requires release inside the exact visible hole. Game-state positions and economic rules are unchanged.

Current QA: v18 interaction evidence passed 29px pickup, two merge partners highlighted/cleared, storage buy-by-drag/extraction/touch cancellation, pit deletion, bomb shake (3.82px with return), upgrade bounce/purchase/no repeated toast and no JavaScript errors. These are prior-version results, not acceptance of the rejected composition. This correction adds six passing targeted mapping tests (row separation, inverse ray, relocated storage/pit hits and drops, occupied pickup); typecheck passes. The new layout's targeted browser screenshots and storage/pit/bomb interaction recheck remain pending with the parent.
