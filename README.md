# DREAM VIEW

A static, browser-rendered exterior home studio built with React, Vite, TypeScript and Three.js. The landing page opens the studio at `#/demo`; existing `#/simulation` links open the same studio. No Vagon session, cloud GPU, account, or backend is required. The existing demo password screen is retained as a casual access gate on both routes. This static frontend cannot protect the public model files from direct downloads.

## Develop

Requires Node.js 24.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The house has orbit/pinch/wheel controls, bounded zoom, reset, proposed finishes, saved perspectives (including an eye-level Street view), PNG export and fullscreen. Entry, interior, patio and garage doors share one color control; each garage style applies to both openings. Email export downloads a PNG for the user to attach in their email app; the site does not upload or send it.

Daylight, golden hour and dusk use live sun/sky illumination, regenerated glass reflections and moving shadow maps. Dusk turns on warm architectural lights. Blender-baked neutral ambient occlusion adds contact detail without preserving midday shadows. AgX tone mapping keeps bright materials and sky reflections within display range. Grass uses dense spatial batches of short blades over photographic turf; foliage uses alpha-tested textured leaves with thin-leaf backlighting. Physical phone and other-browser testing is still needed.

## Asset workflow and release boundary

Blender sources remain separate from this web repository. Only optimized runtime GLBs, surface textures, ambient occlusion, environment lighting and the loading preview are included. The runtime export excludes furniture, decoration, vehicles, source plans, photographs, exact geographic metadata, authoring files and QA evidence. Models served by a website can be downloaded by its visitors.

`viewer/` contains the editable browser renderer and interface. `browser-demo/index.html` is its Vite entry. `public/browser-demo/release-manifest.json` records the runtime asset hashes. To update assets from a separately verified export:

```sh
node tools/prepare-demo.mjs /path/to/verified-runtime-build
npm run build
```

The preparation tool uses an exact allowlist, removes nonessential GLB metadata while preserving the binary payload, and records a fresh manifest. `npm run build` checks the resulting release for unexpected files, private paths/metadata, credentials and remote-renderer URLs. Review newly added assets and generated files before committing.

Neutral AO atlases can be reproduced from the reviewed GLBs alone:

```sh
node tools/bake-occlusion.mjs /path/to/Blender
node tools/refresh-demo-manifest.mjs
```

No source plans or private Blender files are needed. The bake writes only the two neutral AO textures into the runtime folder. Tree preparation is documented in `ASSETS.md`.

## Hosting

The GitHub Pages workflow tests and builds `main`, then publishes `dist`. Relative assets and hash routing support hosting under `/home-sim-demo/`. No API keys or secrets belong in this frontend. The landing-page illustration is fictional and separate from the interactive residence; its provenance is in `ASSETS.md`. Locally served font/icon licenses remain in `public/licenses/`.
