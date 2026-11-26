/**
 * Pure class-name builder shared by the Surface primitive.
 *
 * Every class is kept as a literal string so Tailwind v4 can statically scan
 * the source; never assemble class names from fragments.
 */

/** Stacking class for the scrim layer. */
export const Z_SCRIM = 'z-20';

/** Stacking class for the surface layer. */
export const Z_SURFACE = 'z-30';

/** Supported surface layouts. */
export type SurfaceVariant = 'popover' | 'top-sheet' | 'bottom-sheet';

/** Input accepted by {@link surfaceClasses}. */
export interface SurfaceStyleInput {
  /** Base layout of the surface. */
  variant: SurfaceVariant;
  /** Optional anchored popover override applied from the md breakpoint. */
  mdVariant?: 'popover';
  /** Optional viewport cap; currently only 80vh is supported. */
  maxHeight?: '80vh';
}

/** Shared surface styling applied to every variant. */
const BASE =
  'z-30 bg-white text-left transition duration-150 starting:opacity-0 motion-reduce:transition-none';

const VARIANT_CLASSES: Record<SurfaceVariant, string> = {
  popover:
    'absolute left-0 top-full w-80 rounded-md border border-gray-200 shadow-lg',
  'top-sheet':
    'absolute inset-x-0 top-full border-b border-gray-200 shadow-md starting:-translate-y-2',
  'bottom-sheet':
    'fixed inset-x-0 bottom-0 rounded-t-2xl border-t border-gray-200 shadow-xl starting:translate-y-full',
};

const MD_POPOVER =
  'md:absolute md:bottom-auto md:top-full md:left-14 md:right-auto md:w-80 md:rounded-md md:border md:shadow-lg md:starting:-translate-y-1';

const MAX_HEIGHT_ROOT = 'flex max-h-[80vh] flex-col';

const MAX_HEIGHT_BODY = 'min-h-0 overflow-y-auto';

/**
 * Builds the class names for a surface root and its scrolling body.
 *
 * @param input Variant, optional md override and optional height cap.
 * @returns Object with the `root` class string and the `body` class string.
 */
export function surfaceClasses(input: SurfaceStyleInput): {
  root: string;
  body: string;
} {
  const parts = [BASE, VARIANT_CLASSES[input.variant]];

  if (input.mdVariant === 'popover') {
    parts.push(MD_POPOVER);
  }

  const capped = input.maxHeight === '80vh';
  if (capped) {
    parts.push(MAX_HEIGHT_ROOT);
  }

  return {
    root: parts.join(' '),
    body: capped ? MAX_HEIGHT_BODY : '',
  };
}
