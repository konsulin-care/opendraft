/** Base scrim classes covering the page below the header. */
const SCRIM_CLASS = 'fixed inset-x-0 bottom-0 top-14 z-20 bg-black/20';

/** Scrim variant hidden from the md breakpoint up. */
const SCRIM_BELOW_MD_CLASS = 'md:hidden';

/** Props for {@link Scrim}. */
export interface ScrimProps {
  /** Called when the scrim is pressed. */
  onClose: () => void;
  /** Hide the scrim from the md breakpoint up. */
  belowMdOnly?: boolean;
}

/**
 * Non-interactive backdrop rendered behind a surface.
 *
 * The element is `aria-hidden` so assistive technology never treats it as a
 * control; a pointer press closes the surface through `onClose`.
 *
 * @param props - See {@link ScrimProps}.
 * @returns The scrim markup.
 */
export function Scrim({ onClose, belowMdOnly = false }: ScrimProps) {
  const className = belowMdOnly ? `${SCRIM_CLASS} ${SCRIM_BELOW_MD_CLASS}` : SCRIM_CLASS;

  return <div aria-hidden="true" data-testid="surface-scrim" onClick={onClose} className={className} />;
}
