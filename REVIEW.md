# Demo review and corrections

The review covered both routes, responsive layout, image compositing, motion masks, ambient and pointer behavior, reduced motion, tab visibility, fullscreen, static hosting, and public repository contents.

## Findings corrected

| Finding                                                               | Impact                                                                                             | Correction                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Fixed viewer minimum heights, notes, and footer exceeded the viewport | The old demo measured 1,074px high in a 768px laptop viewport and 998px in an 844px phone viewport | Dynamic viewport grid with a flexible viewer, compact header, and footer inside the viewport                           |
| Four-minute lighting loop and 15-second initial hold                  | Most short visits would see little change                                                          | 80-second loop: 3-second hold and 17-second blend per scene                                                            |
| Broad rectangular water and vegetation regions                        | Motion could bend coping, stone, and other rigid surfaces                                          | Lossless foliage matte, explicit corner/rock exclusions, inset water boundary, and source/destination clipping         |
| Simple repeated wave distortion                                       | Water appeared to wobble rather than carry localized disturbances                                  | Crossing surface waves plus continuously generated random, expanding, damped ripple events                             |
| Cursor-centered oscillation and uniform wind                          | Pointer effects persisted unrealistically and foliage moved together                               | Movement-triggered ripple impulses, decay after departure, variable damped gusts, and smaller independent leaf flutter |
| Separate rendering contexts for each lighting image                   | More resources and independent animation state across scene changes                                | One renderer, one motion field, and shared image compositing                                                           |
| Small controls and short-viewport crowding                            | Harder touch targets and risk of clipped content                                                   | Larger controls and explicit compact portrait/landscape layouts                                                        |

## Verification

- `npm test`: 18 tests pass, covering cycle boundaries, pause/resume, hidden tabs, reduced motion, unavailable stream state, ambient ripple continuity, wind stability, pointer disturbance/decay, coordinate mapping, and exclusion of rigid surfaces.
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

The ambient sway and water were subsequently increased and checked with recorded video through two implementation iterations. The final planting uses damped branch springs, a colour-separated foliage matte, and source/destination clipping. Follow-up regression checks scan the exposed concrete corners and boulder patches, and verify foreground coverage across the frame. See [MOTION_REVIEW.md](MOTION_REVIEW.md) for details.

## 4K and contact footer follow-up

- Large-screen typography, controls, and spacing scale with both viewport dimensions up to 3840 × 2160. Native and Retina 4K canvas sizes are tested, with an 8,294,400-pixel budget. The source image resolution is unchanged.
- Cursor-driven plant and tree displacement has been removed. Pointer strokes affect only water impulses; matching seeded runs verify that wind and branch state remain identical with and without pointer activity.
- Copyright and a contact placeholder appear on both routes. The footer and viewer stay within the viewport at 320 × 568, 390 × 844, 844 × 390, 1920 × 1080, 2560 × 1440, and 3840 × 2160.

## Mobile edge and footer follow-up

- Replace the landing page’s fixed small-viewport height with dynamic viewport height. Keep the photographic backdrop fixed and sized to the large viewport. Enable `viewport-fit=cover` and apply safe-area insets to content.
- Remove the separate residence/concept and tagline row. Copyright, atmosphere controls, and contact information now share a dark footer; small phones wrap the controls into a second row. The preview caption still identifies the image as illustrative.
- Check both routes at 320 × 568, 390 × 664, 390 × 844, 844 × 390, and 3840 × 2160, including simulated portrait and landscape safe-area insets. These are page geometry checks in the in-app browser, not a certification of physical iOS Safari chrome behavior.
- The available host has no iOS Simulator runtime. Safari’s own status/address-bar background treatment remains browser-controlled.
