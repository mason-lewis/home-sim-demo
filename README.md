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

The house has orbit/pinch/wheel controls, bounded zoom, reset, proposed finishes, saved perspectives, PNG export, fullscreen and self-contained GLB import. Imported models stay on the device. Email export downloads a PNG for the user to attach in their email app; the site does not upload or send it.

Daylight uses Blender-baked diffuse irradiance, PBR materials, a matching AgX display transform and glass reflections. Golden hour and Dusk are labeled mood previews with unchanged daylight shadows. Finish edits reuse the original indirect light/reflections. Vegetation and glazing remain raster approximations. Physical phone and other-browser testing is still needed.

## Asset workflow and release boundary

Blender sources remain separate from this web repository. Only optimized runtime GLBs, surface textures, irradiance, environment lighting and the loading preview are included. The runtime export excludes furniture, decoration, vehicles, source plans, photographs, exact geographic metadata, authoring files and QA evidence. Models served by a website can be downloaded by its visitors.

`viewer/` contains the editable browser renderer and interface. `browser-demo/index.html` is its Vite entry. `public/browser-demo/release-manifest.json` records the runtime asset hashes. To update assets from a separately verified export:

```sh
node tools/prepare-demo.mjs /path/to/verified-runtime-build
npm run build
```

The preparation tool uses an exact allowlist, removes nonessential GLB metadata while preserving the binary payload, and records a fresh manifest. `npm run build` checks the resulting release for unexpected files, private paths/metadata, credentials and remote-renderer URLs. Review newly added assets and generated files before committing.

## Hosting

The GitHub Pages workflow tests and builds `main`, then publishes `dist`. Relative assets and hash routing support hosting under `/home-sim-demo/`. No API keys or secrets belong in this frontend. The landing-page illustration is fictional and separate from the interactive residence; its provenance is in `ASSETS.md`. Locally served font/icon licenses remain in `public/licenses/`.
