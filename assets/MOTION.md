# Resume interaction design

This enhancement adapts the interaction patterns in the [Animate UI primitives](https://animate-ui.com/docs/primitives/animate-ui/) to the existing HTML website using browser animation APIs. It does not claim to install or use their React runtime. No third-party runtime or tracking service is loaded.

| Pattern | Resume application |
| --- | --- |
| Splitting Text + Blur / Slide | One-time character entrance of the owner's name |
| Rotating / Swapping Text | Complete engineering phrases with blur transitions |
| Highlight | One shared moving surface in navigation and background controls |
| Tilt | Subtle inner-card depth following the pointer |
| Magnetic | Hero action buttons follow the nearby pointer |
| Ripple Button + Click | Origin-aware ripple and press response on actions |
| Shine | Hover shine on main actions and university badge |
| Counting Number | Existing numeric career highlights, unchanged values |
| Scroll Progress | Page reading progress and experience timeline |
| Auto Height | Measured education/experience expansion, resize and interrupted reversals |
| Effect / Fade / Blur | Staggered section, card and modal entrance |
| Dialog | Real exit animation, focus trap, inert background and restored focus |
| Tooltip | Delayed motion-control hint for intentional hover or keyboard focus |
| Theme Toggler | Existing light/dark switch with icon transition |
| Particles / interactive backgrounds | Original signal, circuit and network canvas |

The canvas is original artwork inspired by electronic information engineering: signal waves, trace routing, chips and network packets. The labels and speed control describe a visual illustration, not measurement or a physical simulation.

Factual resume contents remain from the original page. Typography uses self-hosted fonts and a centered visual axis, defined in `typography.css`. The background is capped at 30 paints/second and device pixel ratio 2. Rendering pauses when the page is hidden. Reduced-motion preference is respected unless the visitor explicitly enables motion, and the motion control persists its setting locally. Fine-pointer tilt/magnetism is not enabled on touch screens.

Reference defaults: Auto Height uses a 300/30 spring; Highlight uses 500/40. Height is measured from the inner element using ResizeObserver, including content reflow. Rapid reversals replace the previous animation, with no arbitrary maximum height.

Primary references:

- https://animate-ui.com/docs/primitives/animate-ui/auto-height
- https://animate-ui.com/docs/primitives/animate-ui/highlight
- https://animate-ui.com/docs/primitives/animate-ui/splitting-text
- https://animate-ui.com/docs/primitives/animate-ui/tilt
- https://animate-ui.com/docs/primitives/animate-ui/magnetic
- https://animate-ui.com/docs/primitives/animate-ui/ripple-button
- https://animate-ui.com/docs/primitives/animate-ui/scroll-progress
