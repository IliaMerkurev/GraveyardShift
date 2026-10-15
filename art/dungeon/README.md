# Graveyard mine: authored low-poly location kit, second art pass

Original geometry and painted surfaces authored for RockSnakePlayableTest against the supplied graveyard mining reference. No skeletons or character assets are included. Existing workers remain placeholders for the separately planned Tripo characters.

## Canonical editable sources

- `src/render/dungeon/DungeonKit.ts`: parametric geometry, placement and material palette.
- `src/render/dungeon/DungeonAtlas.ts`: deterministic 1024 × 1024 painted surface atlas (stone, timber, iron, ore), face UV projection, contact-shadow and amber-light textures. These are generated once in memory; there are no downloaded textures or runtime network requests.
- Geometry is separately named and uses Y-up coordinates. Models can be edited at source or imported into Blender with File → Import → glTF 2.0. Vertex colours carry base paint; atlas UVs add wear and grain.

## Deliverables and exact texture-export distinction

1. `dungeon-model-kit.glb` is the directly generated Node interchange kit: geometry, UVs, vertex colours and PBR materials. It contains fourteen named assemblies and is **not texture-embedded**, because the Node generator intentionally does not emulate browser Canvas. This limitation is also recorded in `model-manifest.json`.
2. `export-textured-kit.html` is a self-contained, offline developer utility containing the actual canonical painter and model builders. Open it in a browser and choose “Download textured GLB” to generate the matching atlas-embedded model kit, or “Download painted atlas PNG” for the exact editable bitmap. It sends no data anywhere. The textured GLB uses the same base colour map as the playable; glTF does not encode Three.js bumpMap directly, so the runtime micro-bump is not represented as a separate glTF normal map.
3. Regenerate Node GLB: `node --experimental-strip-types scripts/export-dungeon-kit.mjs`.
4. Rebuild standalone textured exporter: `node scripts/build-dungeon-export-utility.mjs`.
5. Audit the new kit: `node --experimental-strip-types scripts/audit-dungeon-kit.mjs`.

All commands use the repository's installed development dependencies (Node 24); no additional packages or Blender installation are needed. Export HTML and GLB are developer deliverables, **not embedded in or downloaded by the playable**. Do not add their sizes to the playable's HTML runtime budget.

## Second-pass modelling and surface decisions

- Staggered, differently sized flagstone courses with genuinely perturbed chipped silhouettes, bevels, recessed seams, mottled paint, surface scratches and fissures. Hidden floor side/bottom faces are removed.
- Staggered masonry, deep green crypt recess gradients with layered architectural silhouettes, pointed segmented arches, higher cornices, substantial buttress blocks and bronze grilles.
- Separate dark iron cages, multiple amber/gold flame tongues, warm radial reflected-light decals, low lanterns and contact-shadow decals.
- Broad worn timber track planks, thicker bronze rails, sleepers and a reusable animated wooden conveyor tread geometry.
- Individually curved barrel staves, inset grooved lid, raised metal hoops and rivets; plank crates, diagonal bracing and iron corners.
- Emerald mine cart and deliberate brass coin chest/candle setpieces. Low broken masonry stays at the perimeter.
- Charcoal ore facets with two thin geological fissures following real facet intersections, rather than highlighting every mesh edge.

## Runtime and budget conventions

`dungeonMaterial` is shared MeshStandardMaterial with vertex colours, atlas colour map, micro-bump and high roughness. `dungeonGlowMaterial` is shared unlit colour. Do not dispose these shared materials when removing an individual prop. Factory geometry is owned by its returned object and may be disposed on teardown.

Room batching uses **four draw calls**, not the initial pass's two: opaque geometry, emissive geometry, contact shadows, amber reflected light. Current portrait room: **25,032 triangles**. Landscape room: **34,560 triangles**. Only one room should be visible. These totals exclude dynamic entities, track and effects; integration owns the final rendered scene and standalone HTML budget.

Ore base radius 0.225 with deterministic 13% deformation (maximum 0.25425 from its pivot), preserving the original path spacing. Barrel bounds approximately 0.65 units. Worker pad 0.94 × 0.13 × 0.87. Storage top approximately Y=0.23. Track plank top Y=0.024; thicker rails sit above it. Arches face +Z. Room bounds and all gameplay coordinates are supplied by the renderer; no factory mutates state, economy, timing, input or camera.

## Validation and ownership

`geometry-audit.json` records finite geometry, matching vertex-colour and UV counts, upward floor winding, ore radius, four-call room batching, bounded room triangles and degenerate track input checks. TypeScript typecheck also passed. Actual browser visual acceptance belongs to the integrated game, rather than this geometry-only audit.

All geometry and procedural paint are newly authored for this task. No third-party models, downloaded image textures or character assets were imported.
