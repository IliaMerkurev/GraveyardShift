# Graveyard mine: low-poly location kit

Original geometry authored for RockSnakePlayableTest against the supplied graveyard mining reference. No skeleton/character assets are included. Existing workers remain placeholders for the separately planned Tripo characters.

## Editable source and DCC interchange

- `src/render/dungeon/DungeonKit.ts` is the canonical parametric modelling source. It contains reusable, named builders rather than an opaque baked scene.
- `art/dungeon/dungeon-model-kit.glb` is a glTF 2.0 model sheet containing 13 separately named assemblies. Import directly into Blender with File → Import → glTF 2.0. Individual merged assemblies can be separated by loose parts in Edit Mode if needed. Vertex colours carry the material palette.
- Regenerate using `node --experimental-strip-types scripts/export-dungeon-kit.mjs` after `npm ci` (Node 24).
- `model-manifest.json` reports actual exported model counts and triangle counts.
- The GLB is an editable interchange deliverable, not downloaded or embedded by the playable. The playable compiles only the procedural source. No texture images, fonts, new dependencies, or runtime network requests.

## Modelling decisions

Clipped octagonal stone silhouettes and raised bevels create readable seams. Floor tiles omit hidden vertical and bottom faces. Walls use staggered courses, receding green niches, segmented pointed arches, buttress blocks, and metal grilles. Shallow perimeter props leave the gameplay area and front edge unobscured. Warm wood, bronze rails, amber lanterns and flame meshes contrast with charcoal stone and restrained green mineral seams. The mine cart contains faceted crystals. Barrels use individual curved stave surfaces, separate lid grooves, raised hoops and rivets; crates use side planks, iron corners and diagonal braces.

No shadows or lights are embedded in the kit. Integration owns the lighting; at most one shadowcaster is recommended. Emissive colour comes from the shared unlit material, with no bloom/postprocessing requirement.

## Runtime conventions

Y-up. Origin of props is floor-contact; ore is centred on its existing instancing pivot. Barrel bounds match the old approximately 0.65-unit cargo. Ore base radius is 0.225 with deterministic 13% deformation (maximum 0.25425), preserving the prior path spacing and silhouette budget. Worker pad 0.94 × 0.13 × 0.87; storage top approximately 0.23. Gothic arches face +Z; rotate the assembly for finish alignment. Track planks top out at Y=0.024 and rails at approximately 0.075.

Rooms are batched to exactly two draw calls: one vertex-colour opaque mesh, one unlit accent mesh. Current portrait room: 20,034 triangles; landscape room: 28,722 triangles. These exclude path, dynamic entities and effects. Only the active room should be visible. Do not scale one room nonuniformly to change aspect ratio: build separate portrait and landscape rooms to preserve stone dimensions.

`dungeonMaterial` and `dungeonGlowMaterial` are shared. Do not dispose them when removing individual props. Each builder allocates its own geometry; dispose those geometry objects on teardown. No factory mutates game state, hit targets, coordinates, timing or camera layout.

## Ownership

All geometry in this directory is newly authored for this task; no third-party model or image assets were imported. The supplied reference guided visual direction only.
