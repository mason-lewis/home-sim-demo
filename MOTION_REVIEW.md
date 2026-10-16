# Ambient motion video review

The motion was revised twice, then recorded again for final review. All review clips run for 12 seconds at normal speed with fixed daylight and the pointer outside the scene. Fixing the light removes day/night crossfades from the motion assessment.

## Changes retained

- **First revision:** stronger ambient displacement, coordinated leaf-cluster movement, bending shrub tips, and stronger crossing water waves. Sampling the displaced foliage silhouette avoids pinning each leaf edge to its original position.
- **Second revision:** replace the large sine-driven sway with three damped spring responses for the canopy, shrub stems, and secondary branches. They respond to the same varying wind with different inertia, lag, and recoil. Small leaf flutter remains separate from the large movement.
- **Water:** raise the crossing-wave displacement by about 50–65%, increase ripple displacement modestly, and attenuate samples near the pool boundary. Pointer impulses continue to spread and fade; ambient movement never depends on hovering.
- **Cursor:** keep the extra foliage response smaller than the ambient motion, so pointing adds a local disturbance rather than switching the wind on.

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

Run `npm run dev`, then open `/tools/motion-review.html`. Select a fixed lighting scene and record without moving the pointer over the image. The tool uses the production renderer with a repeatable random seed. Recordings stay local. The review page and its recording code are excluded from the production build.
