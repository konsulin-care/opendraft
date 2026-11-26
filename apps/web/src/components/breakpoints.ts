/**
 * Single source of truth for the width boundaries used by the web app.
 *
 * The pixel values mirror the Tailwind scale: `sm` is 640px, `md` is 768px and
 * `lg` is 1024px. Tailwind class strings stay literal in the components (`md:`,
 * `hidden md:flex`, ...) because Tailwind v4 scans source text statically, so
 * this module exists for the JavaScript side and for the tests: media queries
 * imported from here can never drift from the `md` breakpoint the CSS uses.
 */

/** Small boundary in pixels; the Tailwind `sm` breakpoint. */
export const SM_PX = 640;

/** Medium boundary in pixels; the Tailwind `md` breakpoint. */
export const MD_PX = 768;

/** Large boundary in pixels; the Tailwind `lg` breakpoint. */
export const LG_PX = 1024;

/** Media query matching viewports below the medium (md) breakpoint. */
export const NARROW_QUERY = `(max-width: ${MD_PX - 1}px)`;

/** Media query matching viewports at or above the large (lg) breakpoint. */
export const WIDE_QUERY = `(min-width: ${LG_PX}px)`;
