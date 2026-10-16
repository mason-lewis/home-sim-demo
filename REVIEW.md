# Demo review and corrections

The review covered both routes, responsive layout, image compositing, motion masks, ambient and pointer behavior, reduced motion, tab visibility, fullscreen, static hosting, and public repository contents.

## Findings corrected

| Finding                                                               | Impact                                                                                             | Correction                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Fixed viewer minimum heights, notes, and footer exceeded the viewport | The old demo measured 1,074px high in a 768px laptop viewport and 998px in an 844px phone viewport | Dynamic viewport grid with a flexible viewer, compact header, and no separate footer                                   |
| Four-minute lighting loop and 15-second initial hold                  | Most short visits would see little change                                                          | 80-second loop: 3-second hold and 17-second blend per scene                                                            |
| Broad rectangular water and vegetation regions                        | Motion could bend coping, stone, and other rigid surfaces                                          | Authored pool/planting/canopy mask, inset water boundary, and daylight-based foliage refinement                        |
| Simple repeated wave distortion                                       | Water appeared to wobble rather than carry localized disturbances                                  | Crossing surface waves plus continuously generated random, expanding, damped ripple events                             |
| Cursor-centered oscillation and uniform wind                          | Pointer effects persisted unrealistically and foliage moved together                               | Movement-triggered ripple impulses, decay after departure, variable damped gusts, and smaller independent leaf flutter |
| Separate rendering contexts for each lighting image                   | More resources and independent animation state across scene changes                                | One renderer, one motion field, and shared image compositing                                                           |
| Small controls and short-viewport crowding                            | Harder touch targets and risk of clipped content                                                   | Larger controls and explicit compact portrait/landscape layouts                                                        |

## Verification

- `npm test`: 15 tests pass, covering cycle boundaries, pause/resume, hidden tabs, reduced motion, unavailable stream state, ambient ripple continuity, wind stability, pointer disturbance/decay, coordinate mapping, and exclusion of rigid surfaces.
- TypeScript checks and production build pass.
- Browser measurements on the demo route showed document dimensions equal to the viewport, with no horizontal or vertical page overflow and no placeholder content beneath the toolbar:
  - 320 × 568
  - 390 × 844
  - 844 × 390
  - 820 × 1180
  - 1366 × 768
  - 1024 × 600
- Fullscreen entry and exit work. The unconfigured viewer creates no iframe.
- Consecutive browser screenshots while paused had zero differing pixel channels, confirming that both the light cycle and ambient renderer hold still.
- Two browser frames, captured 259ms apart with no pointer input during the initial lighting hold, showed changes in sampled pool, canopy, and bush regions. Sampled stone-wall and residence regions had zero pixel change. This verifies localized ambient movement; it does not establish complete scene segmentation.
- Production remains a static frontend with locally hosted fonts and fictional architecture. No private models, credentials, analytics, or location access were added.

## Limits

The motion is an image-based visual effect, not a three-dimensional fluid or vegetation simulation. The reviewed browser supports WebGL; static images remain the fallback when WebGL is unavailable. Reduced-motion preferences and the pause control intentionally stop automatic effects. Real-device GPU performance, every browser/assistive-technology combination, and Vagon integration were not certified in this review.

## Follow-up motion calibration

The ambient sway and water were subsequently increased and checked with recorded video through two implementation iterations. The final planting uses damped branch springs and coordinated silhouette movement. See [MOTION_REVIEW.md](MOTION_REVIEW.md) for details.
