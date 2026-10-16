# FORM / SPACE

A cinematic, single-screen entry to an architectural walkthrough demo. Built with React, Vite, and TypeScript; runs entirely as a static site.

The primary action opens the demo viewer at `#/simulation`. Until a public stream is connected, the viewer clearly says “Walkthrough coming soon.” No stream is requested and no iframe is created in that state.

## Develop

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

## Atmosphere

The residence cycles automatically through dusk, night, morning, and daylight over 80 seconds. Each scene holds for 3 seconds and blends into the next for 17 seconds. Timing is independent of the visitor’s timezone. The cycle pauses when the tab is hidden and resumes without jumping.

Water, tree canopy, and foreground planting move continuously through one WebGL renderer. An authored mask confines the effect to the pool surface and planting, excluding the coping, stone wall, and house. Crossing surface waves and random ambient ripple events keep the pool active without pointer input. Variable gusts drive damped foliage motion. Pointer movement adds expanding ripples or local foliage movement; these disturbances decay after departure. The residence itself remains still. This is an illustrative image effect, not a live model or physically simulated environment.

The pause control stops both lighting and nature motion. Reduced-motion preferences disable automatic motion. Static images remain available if WebGL is unavailable. Fonts and optimized responsive images are served locally; there are no analytics, location requests, or external runtime assets.

- Scene timing and blending: `src/lighting.ts`
- Cycle state, visibility, and reduced motion: `src/useAtmosphere.ts`
- Nature motion wrapper: `src/NatureMotion.tsx`
- Mask, wave field, wind, and pointer response: `src/nature/` and `public/images/nature-mask.svg`
- Branding and future stream URL: `src/config.ts`

## Future Vagon connection

Set `streamUrl` in `src/config.ts` only to an intentionally public HTTPS embed URL once the stream is ready. Verify the provider’s embedding requirements, allowed origins, fullscreen, pointer-lock, and other required iframe permissions before connecting it. No provider-specific integration is configured in this version.

All frontend configuration is public. Never add API keys, access tokens, signed/private model URLs, client files, or proprietary simulation source to this repository. Any future protected session creation must happen outside this static frontend.

## GitHub Pages

The deployment workflow builds and tests `main`, then publishes `dist` using GitHub Pages Actions. In repository **Settings → Pages**, use **GitHub Actions** as the source. Relative Vite asset paths and hash routing support hosting under `/home-sim-demo/`, including refreshes on the simulation route.

No backend, database, user accounts, or secrets are required.

The demo viewer fills the available dynamic viewport height, with no fixed minimum viewer height or separate footer. It has no page scroll in portrait or landscape layouts.

## Assets

The four residence scenes are AI-generated fictional architecture, created with the built-in image generation tool. They contain no client plans, actual project models, or confidential business material. Image generation notes are in `ASSETS.md`.

The house favicon is an original SVG. DM Sans and Manrope are locally bundled through Fontsource under their accompanying open font licenses. Lucide icons use the ISC license. Dependency licenses remain in their packages.
