# Exterior model validation

Architectural plans, elevations, and details control this local branch. The
reviewed wall and opening data retain their source uncertainty. Mason explicitly
excluded the rendered house image on 2026-10-17. Never use that rendering for
dimensions, design, materials, or colors. Screenshots identify defects.

Keep authoring inputs, plans, intermediate exports, and evidence in ignored local
folders. Preserve the pinned inputs. Do not edit the native project's frozen
compiler or publish private references.

## Rebuild

`tools/blender/regenerate_exterior.py` is the local exterior generator. It starts
from the pinned shell, replaces exterior finishes, fits wall tops to the retained
roof underside, and clips confirmed exposed coplanar conflicts. Openings, trim,
and siding use the same wall coordinates. Battens keep the documented 2.5-inch
width and 16-inch pitch. Bands and trim use the elevation callouts.

Create an ignored `configuration.local.json` with absolute paths for `blender`,
`baseline` (pinned shell), `house` (reviewed JSON), `scene` (packed demo), and
`workRoot` (an ignored output directory). Then run:

```sh
node tools/rebuild-exterior.mjs configuration.local.json
```

This regenerates twice, compares geometry hashes, exports the house, losslessly
compresses all geometry buffers, decodes the delivered asset, measures saved
geometry, rebuilds the house AO, packs textures, and reopens both Blender files.
Every run gets its own folder. Saved Blender names use the actual Eastern save
date, time, and applicable timezone abbreviation.

After reviewing the staged result, promotion uses the saved paths:

```sh
node tools/promote-exterior.mjs STAGED_RUNTIME MEASUREMENTS_JSON REGENERATION_JSON
node tools/refresh-demo-manifest.mjs
```

`--promote` on the rebuild command performs those same gated local copies. It
changes only the house GLB and its contact AO. Restart Vite after updating the
manifest so the cache revision changes. It does not publish anything.

## Geometry and dimensional gates

- Generation stops on remaining confirmed exposed coplanar conflicts or invalid
  polygons. Plane grouping uses 0.01 mm; overlap areas below 0.1 square mm are
  excluded. Opposing construction contacts and concealed joints are retained.
- The scan compares actual convex faces after evaluated modifiers. It is an
  axis-aligned coplanar scan, not a general proof of all mesh intersections.
  Sloped roof contacts and noncoplanar joins require visual review.
- Packing refuses an unchecked source or any critical generation failure. Every
  compressed buffer is decoded and compared byte for byte. Positions, normals,
  UVs, and index sequences are not quantized.
- Measurement uses actual saved Blender faces and independently decoded GLB
  triangles. Aperture boundaries come from face intersections at midheight and
  midwidth. At floor-level apertures, the saved floor slab defines the bottom.
  Both outputs are compared with the reviewed coordinates at 3 mm uncertainty.
- Batten/member bounds, band heights, and roof planes are measured separately.
  A tight arithmetic tolerance checks exact nominal profiles; it does not relax
  the architectural tolerance. Pitch is a dimensionless rise/run value.
- Promotion refuses dimensional failures, missing dependencies, invalid meshes,
  different repeated geometry, or a staged asset with a different measured hash. Ray probes at both fireplace
  apron corners verify that FC trim, rather than exposed slab, is the first
  visible surface in both saved and decoded geometry. The prior unmitered
  version must fail those probes.

Run targeted checks when editing these rules:

```sh
python3 -m unittest discover -s tests -p test_facade_rules.py
BLENDER --background --factory-startup --disable-autoexec --python tools/blender/test_surface_gate.py
npm test
npm run build
```

The Blender fixture injects duplicate exposed faces and verifies that opposing
contact joints survive. Node tests check failure gates, door controls, preserved
window/rail materials, camera protection, and shadow coverage.

## Visual review

Use `?qa=1&fullCanvas=1` on the local browser viewer. Inspection controls expose
fixed gable, entry, utility-door, band, elevation, roof, and overview views. These
controls do not restrict the normal product orbit. Save camera, target, shading,
model SHA-256, cache revision, and the 6.5% vertical view offset with each capture.
The Blender perspective cameras must match that projection offset as well as
position, target, field of view, and aspect ratio. Let each rendered frame settle
before taking a screenshot; verify its visible view label and recorded camera.

1. Save original runtime files and matching before views before replacement.
2. Run `render_exterior_inspection.py` on the saved source for neutral and
   material views; run it with `--orbit` for a full inspection sequence. Render
   the packed demo in material mode with `--retained-lighting` as well.
3. Use `render_elevations.py` for all four orthographic elevations. Compare them
   beside the architectural sheets at their stated scale. Use common floor
   datums. Translate source crops; never stretch them to hide differences.
4. Capture every fixed browser view in neutral geometry, materials without sun
   shadows, and final lighting. Compare Blender with the exact browser asset.
5. Inspect a full browser orbit at 15-degree steps in all three shading modes,
   plus close moving views and normal interactive motion. Review individual
   frames where contact sheets show a possible gap or flashing surface.
6. Check dark and light proposed finishes. Exercise the existing door, garage,
   color, and time-of-day controls. Record material proposals as proposals.
7. Verify the browser's computed model SHA-256 against the measured delivered
   file. Confirm the manifest revision and requested asset URL changed.
8. Build the private review with `tools/build-model-evidence.py`. Inspect the
   composed images and all reported differences before writing acceptance.

Geometry corrections precede lighting adjustments. Diagnose remaining shimmer
by comparing identical cameras with and without shadows. The repaired shadow
projection spends texels on the house and keeps upstream space for tree casters.
It retains sun direction, intensity, environment, and materials. AO is neutral
contact occlusion with a 203.2 mm radius, separate from live directional shadows.

## Limits to report

Do not certify manufacturer rough openings from nominal window labels. Keep
unspecified profiles, batten projection, finishes, concealed construction, and
foundation details provisional. The source has a known conflict between its
35-foot height label and its plotted guard elevation. Keep this unresolved;
do not distort the model or drawing to make both pass.

The local change record must name source files and hashes, changed objects,
causes, join adjustments, actual tests, images reviewed, and unresolved details.
Successful scripts or numeric checks alone do not establish visual correctness.
