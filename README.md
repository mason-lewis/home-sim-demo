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

Every fresh page load starts in morning light, then cycles through daylight, dusk, and night over 80 seconds. Each scene holds for 3 seconds and blends into the next for 17 seconds. Timing is independent of the visitor’s timezone. The cycle pauses when the tab is hidden and resumes without jumping.

Water, tree canopy, and foreground planting move continuously through one WebGL renderer. A lossless foliage matte combines hand-traced regions, explicit stone exclusions, and daylight colour separation. A separate movement-permission channel protects both ends of each displaced sample, so moving leaf detail cannot pull the terrace corner or foreground rocks into the effect. Crossing surface waves and random ambient ripple events keep the pool active without pointer input. Variable gusts drive separate damped springs for canopy branches, shrub stems, and secondary branches; small leaf flutter is layered over coherent sway. Pointer movement affects only the water, adding expanding ripples with at least three times the strength of ambient ripple events. These disturbances decay after departure. Trees and shrubs respond only to the natural wind field. The residence itself remains still. This is an illustrative image effect, not a live model or physically simulated environment.

The landing page uses a light, text-side gradient. The viewer keeps the image bright, with the unavailable message in a compact panel instead of darkening the entire frame.

The pause control stops both lighting and nature motion. Reduced-motion preferences disable automatic motion. Static images remain available if WebGL is unavailable. Fonts and optimized responsive images are served locally; there are no analytics, location requests, or external runtime assets.

- Scene timing and blending: `src/lighting.ts`
- Cycle state, visibility, and reduced motion: `src/useAtmosphere.ts`
- Nature motion wrapper: `src/NatureMotion.tsx`
- Mask, wave field, wind, and pointer response: `src/nature/` and `public/images/nature-mask.webp`
- Branding and future stream URL: `src/config.ts`

## Large displays and footer

The interface scales its type, controls, and spacing up to a 3840 × 2160 viewport. The animated canvas supports a native 4K buffer, including a 1920 × 1080 CSS viewport at 2× pixel density. A 4K pixel budget bounds GPU work on larger or denser displays. The current photographic source assets remain 1672 × 941; the 4K layout and canvas do not create additional photographic detail.

Both routes include a compact copyright footer. Set `copyrightOwner` and an intentionally public `contactEmail` in `src/config.ts`. Until an address is provided, the footer shows “Enquiries · Email coming soon” without a fake email link. The copyright year updates automatically.

## Future Vagon connection

Set `streamUrl` in `src/config.ts` only to an intentionally public HTTPS embed URL once the stream is ready. Verify the provider’s embedding requirements, allowed origins, fullscreen, pointer-lock, and other required iframe permissions before connecting it. No provider-specific integration is configured in this version.

All frontend configuration is public. Never add API keys, access tokens, signed/private model URLs, client files, or proprietary simulation source to this repository. Any future protected session creation must happen outside this static frontend.

## GitHub Pages

The deployment workflow builds and tests `main`, then publishes `dist` using GitHub Pages Actions. In repository **Settings → Pages**, use **GitHub Actions** as the source. Relative Vite asset paths and hash routing support hosting under `/home-sim-demo/`, including refreshes on the simulation route.

No backend, database, user accounts, or secrets are required.

The demo viewer fills the available dynamic viewport height, with no fixed minimum viewer height. Its compact footer shares the viewport with the viewer. It has no page scroll in portrait or landscape layouts.

## Assets

The four residence scenes are AI-generated fictional architecture, created with the built-in image generation tool. They contain no client plans, actual project models, or confidential business material. Image generation notes are in `ASSETS.md`.

The house favicon is an original SVG. DM Sans and Manrope are locally bundled through Fontsource under their accompanying open font licenses. Lucide icons use the ISC license. Dependency licenses remain in their packages.

## Motion video review

The motion was calibrated with recorded revisions, including targeted concrete-corner and foreground planting checks. See [MOTION_REVIEW.md](MOTION_REVIEW.md) for the checks, references, and local recording workflow.

Rebuild the motion matte with `npm run assets:mask` after editing `tools/nature-regions.svg` or replacing the daylight image. The generator uses the existing Sharp development dependency; no segmentation runs in the visitor’s browser.
