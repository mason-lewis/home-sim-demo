# Ambient motion video review

The motion was revised twice, then recorded again for final review. The initial review clips run for 12 seconds at normal speed with fixed daylight and the pointer outside the scene. Follow-up clips also test scripted cursor strokes. Fixing the light removes day/night crossfades from the motion assessment.

## Changes retained

- **First revision:** stronger ambient displacement, coordinated leaf-cluster movement, bending shrub tips, and stronger crossing water waves. Sampling the displaced foliage silhouette avoids pinning each leaf edge to its original position; the follow-up below adds a separate rigid-surface guard.
- **Second revision:** replace the large sine-driven sway with three damped spring responses for the canopy, shrub stems, and secondary branches. They respond to the same varying wind with different inertia, lag, and recoil. Small leaf flutter remains separate from the large movement.
- **Water:** raise the crossing-wave displacement by about 50–65%, increase ripple displacement modestly, and attenuate samples near the pool boundary. Pointer impulses continue to spread and fade; ambient movement never depends on hovering.
- **Cursor (initial calibration):** keep the extra foliage response smaller than the ambient motion. This response was later removed; see the current pointer behavior below.

## Video checks

Captured a baseline, the first revision, the spring-driven revision, and a final capture. The recordings were decoded for inspection at half-second intervals, and the recorded playback was checked at its normal rate.

The inspected canopy and shrub patches show larger, coherent travel rather than only local texture shimmer. The final clip has slower recovery and differing phase between nearby planting. The sampled house detail tracked at zero displacement in all clips. Compressed video contains small codec changes even in static regions, so pixel differences alone were not treated as proof of physical accuracy.

The final MP4 preview is a local review artifact, not a production background video. The site continues to render the effect interactively, with no video download required at runtime.

## References

- [Oak canopy in a summer breeze — Joshua Woroniecki](https://www.pexels.com/video/gentle-summer-breeze-through-majestic-oak-tree-36482293/)
- [Pool ripples and reflections — Engin Akyurt](https://www.pexels.com/video/water-ripples-and-reflections-in-the-swimming-pool-12758192/)
- [GPU Gems 3: procedural wind animation](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-6-gpu-generated-procedural-wind-animations-trees), used for the distinction between coordinated branch movement, smaller turbulence, and damped elastic response.
- [GPU Gems: water simulation from physical models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models), used for the distinction between directional wind waves and local circular disturbances.

This is a physically inspired image effect. It does not reconstruct hidden plant geometry or solve a full fluid simulation.

## Repeat locally

Run `npm run dev`, then open `/tools/motion-review.html`. Select a fixed lighting scene and choose Ambient only or Cursor sweep. The sweep leaves three seconds of ambient motion, moves across the water for five seconds, and lets the result decay for four seconds. The tool uses the production renderer with a repeatable random seed. Recordings stay local. The review page and its recording code are excluded from the production build.

## Corner, foreground, and cursor follow-up

The original mask let the terrace corner move with the neighbouring shrub. Replace that runtime colour guess with a lossless matte built from hand-traced regions, colour-separated leaf tips, dense foreground plant bodies, and explicit exclusions for concrete and boulders. The matte has a separate movement-permission channel. Both the original pixel and displaced sample must respect that permission, while leaf detail can still move within the planting. Lavender flowers and grey foreground leaves now travel with their shrub clusters.

A first conservative version kept the corner still but pinned too much foliage; it was rejected after recording. Separating leaf detail from movement permission restored the canopy and foreground sway. A further foreground pass carries entire dense shrub bodies, with roots below the image rather than at the lower border.

The final fixed-daylight recording was decoded at half-second intervals. Small tracked patches at the terrace corner, pool corner, and central boulder each showed zero tracked translation; foreground patches at the left, centre, and right travelled about 12–13 pixels peak to peak in the 1280px-wide capture. These measurements check the selected details, not every pixel of the scene. Regression tests also scan whole corner and boulder patches in the published matte.

Pointer strokes now create impulses with strength 2.8–4.6, compared with ambient events at 0.45–0.85. Fast strokes add more energy within that bound. A separate twelve-second recording uses a repeatable water stroke from seconds 3–8, followed by four seconds of decay. Ambient wave motion and random ripples continue without input.

The landing-page gradient was also reduced and narrowed toward the text. The viewer has only a 2% image tint; a compact message panel replaces the previous full-frame 46–88% dark overlay.

## Current pointer behavior

Cursor interaction with foliage was subsequently removed at the user's request. Trees, leaves, and shrubs now use only the ambient wind springs and flutter. The water keeps its stronger movement-triggered cursor ripples and continuous ambient waves. No pointer-position or pointer-force uniforms remain in the foliage shader.
