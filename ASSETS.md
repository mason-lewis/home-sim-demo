# Landing page image provenance

The landing-page residence is fictional, generated for this demo with the built-in image generation tool. Its surroundings, floor plan implications, and lighting do not represent a real client project. The water and foliage effects are procedural image distortions layered over these images.

## Morning source prompt

Use case: photorealistic-natural. Production website hero asset, landscape 16:9, no text no UI no watermark. A fictional exquisite contemporary custom residence on a wooded hillside, two levels of warm limestone and slender dark steel floor-to-ceiling glass, long horizontal roof planes, warm oak interior, wide stone terrace and reflecting pool at lower right, mature oak tree at right edge. Camera from garden looking toward house, house fills right two thirds, open atmospheric landscape and sky on left for text overlay. Architectural editorial photography, realistic restrained materials, no people, no vehicles. Lighting: clear soft morning sun with delicate warm highlights and pale blue sky. This exact fixed camera composition will be used for multiple times of day; precise coherent architecture. Very high detail, sophisticated quiet aesthetic.

## Day, dusk, and night edit prompts

Each edit used the morning source as its image reference with this template:

> Use case: lighting-weather. Edit this exact residence photograph for [scene]. Change only lighting, sky brightness and color, shadows, reflections, and artificial illumination to [lighting]. Preserve exactly the architecture, all rooflines, structural columns, furniture, trees, landscape, pool, camera position, crop and composition. No text, UI, people, vehicles, watermark. Output a photorealistic landscape 16:9 website hero image, same framing.

Lighting substitutions:

- **Day:** bright natural midday daylight, neutral blue sky, crisp but soft shadows, interiors naturally lit.
- **Dusk:** just after sunset, warm peach and muted lavender blue sky, warm interior and terrace lights glowing, balanced blue-hour exposure.
- **Night:** true nighttime, deep navy sky with a few subtle stars, very faint moonlight, warm interior and terrace lighting luminous, landscape dark but architectural details visible.

## Published assets

All production images are saved in `public/images/` as `residence-{morning,day,dusk,night}.webp`, with corresponding `-mobile.webp` variants. The source PNGs are excluded from the public repository to avoid unnecessary size.

To regenerate optimized images from a local folder containing `morning.png`, `day.png`, `dusk.png`, and `night.png`:

```sh
node scripts/optimize-images.mjs /path/to/source-images
```

The lossless `nature-mask.webp` is generated from the fictional daylight image and the authored `tools/nature-regions.svg`. Run `npm run assets:mask` to rebuild it. It contains water, planting, and canopy coverage, with explicit exclusions for the terrace corner, pool corner, and foreground rocks.

## Interactive exterior studio

The 3D studio is a separately authored architectural model, not the fictional landing-page illustration. Only optimized runtime derivatives are included. Authoring models, architectural plans, reference photos and private QA evidence are excluded. The viewer keeps the exterior shell and basic structure, with no furniture, vehicles or decorations. Landscaping and proposed finish choices are illustrative.

Runtime material sources: ambientCG Grass004 (ambientCG, CC0, https://ambientcg.com/a/Grass004, license https://docs.ambientcg.com/license/); Poly Haven Jacaranda Tree (Rico Cilliers, with guidance by Rob Tuytel), Granular Concrete, Clean Asphalt (Dimitrios Savva), all CC0, https://polyhaven.com/license. See public/licenses/exterior-assets.txt. Original download records and derivative hashes are retained in the separate authoring project.

Environment lighting: Kloofendal 48d Partly Cloudy (Pure Sky), Greg Zaal and Jarod Guest, Poly Haven, CC0, https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky. House surface textures are authored procedural PBR materials. Three.js and meshoptimizer licenses are retained in public/licenses/.

### Landscape and lighting update

The retained tree placements use a web derivative of [Jacaranda Tree](https://polyhaven.com/a/jacaranda_tree), by Rico Cilliers with guidance by Rob Tuytel, under [CC0](https://polyhaven.com/license). The public derivative retains 360,000 leaf triangles, 45,000 branch triangles and 18,000 trunk triangles. Leaf cutout alpha is retained. Normal/UV precision is reduced below visible pixel scale and the GLB uses meshopt compression; the catalog source files are excluded.

To reproduce the tree derivative, download the official 2K glTF and its included buffers/textures from `https://api.polyhaven.com/files/jacaranda_tree`, plus the 2K leaves alpha PNG. In a temporary source folder, combine the leaf diffuse RGB and alpha into `textures/leaves-rgba.png`, then run:

```sh
/path/to/Blender --background --factory-startup --python tools/prepare-tree.py -- /temporary/source/jacaranda_tree_2k.gltf /temporary/tree-web.glb
node tools/pack-tree.mjs /temporary/tree-web.glb
node tools/refresh-demo-manifest.mjs
```

The architectural geometry is unchanged. The driveway beyond the far street shoulder is reclassified as lawn at runtime. Grass uses eight short curved blades per spatially batched patch on desktop and five on narrow screens, photographic turf, restrained color variation and slight mowing variation. Daylight, golden hour and dusk use real-time sun/sky and shadow maps. Neutral contact-occlusion atlases are baked from the reviewed architectural/site GLBs with `tools/bake-occlusion.mjs`; they contain no directional daylight shadows.
