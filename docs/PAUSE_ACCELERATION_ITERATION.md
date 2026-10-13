# Pause also freezes acceleration — prototype/0.2

Owner feedback: the snake must not gain speed during its pause.

A separate `difficultyTime` tracks snake acceleration. It starts at zero on restart and advances only outside the purple bonus freeze and global pause. Game time still advances during bonus freeze, keeping mining, the conveyor and their effects at their existing pace.

Each fixed step excludes exactly its frozen portion. If the bonus expires inside a step, only the remaining unfrozen fraction advances difficulty and snake motion. Repeated pause tokens refresh the existing duration without advancing or resetting difficulty. Global pause stops both clocks and the bonus countdown.

Movement, permanent slowdown activation and the read-only forward-speed render mirror all calculate speed using this same difficulty clock. A slowdown collected during freeze reduces the held underlying forward speed. Ordinary gap recovery and rewind continue aging difficulty, as before; rewind never resets it. Acceleration coefficients, slowdown floor, existing reductions, pause duration and other gameplay rules are unchanged.

## Delivery scope

Source review, direct Vite bundling and standalone packaging only. No tests, typecheck, browser or gameplay QA run, per the owner's current instruction. Packaging retains its built-in embedded-JavaScript syntax and dependency checks. Existing historical test expectations that equate total game time with difficulty time need adjustment before any future authorized test run. Gameplay review remains with the owner.
