# Image provenance

The residence is fictional, generated for this demo with the built-in image generation tool. Its surroundings, floor plan implications, and lighting do not represent a real client project. The water and foliage effects are procedural image distortions layered over these images.

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
