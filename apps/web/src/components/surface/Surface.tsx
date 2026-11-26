import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Scrim } from './Scrim';
import { surfaceClasses } from './surface-styles';
import type { SurfaceVariant } from './surface-styles';

/** Shared button styling for the close control. */
const CLOSE_BASE =
  'items-center justify-center rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black';

/** Close button visible at every breakpoint. */
const CLOSE_ALWAYS = 'inline-flex';

/** Close button hidden below md and visible from md up. */
const CLOSE_MD = 'hidden md:inline-flex';

/** Header row holding the title and the close button. */
const HEADER_CLASS = 'flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2';

/** Title text in the header row. */
const TITLE_CLASS = 'truncate text-sm font-semibold text-gray-900';

/** Header variant of the close button, sized to sit inside the row. */
const CLOSE_HEADER_CLASS = 'shrink-0';

/** Floating variant of the close button when there is no header. */
const CLOSE_FLOATING_CLASS = 'absolute right-2 top-2';

/** Props for {@link Surface}. */
export interface SurfaceProps {
  /** Optional element id, referenced by a trigger's aria-controls. */
  id?: string;
  /** Accessible name of the surface. */
  label: string;
  /** ARIA role describing the surface. */
  role: 'region' | 'dialog';
  /** Base layout of the surface. */
  variant: SurfaceVariant;
  /** Optional anchored popover override applied from the md breakpoint. */
  mdVariant?: 'popover';
  /** Optional viewport cap; currently only 80vh is supported. */
  maxHeight?: '80vh';
  /** Scrim behaviour; defaults to no scrim. */
  scrim?: 'always' | 'below-md' | 'none';
  /** Optional header title; adds the header row when present. */
  title?: string;
  /** Accessible name of the close button; defaults to "Close". */
  closeLabel?: string;
  /** Close button visibility; defaults to no close button. */
  closeButton?: 'always' | 'md' | 'none';
  /** Called when the scrim or the close button is pressed. */
  onClose: () => void;
  /** Surface body content. */
  children: ReactNode;
}

/**
 * Shared overlay surface: scrim, role/label/id, optional title header, close
 * button and scrolling body.
 *
 * @param props - See {@link SurfaceProps}.
 * @returns The scrim (when enabled) and the surface element.
 */
export function Surface({
  id,
  label,
  role,
  variant,
  mdVariant,
  maxHeight,
  scrim = 'none',
  title,
  closeLabel = 'Close',
  closeButton = 'none',
  onClose,
  children,
}: SurfaceProps) {
  const { root, body } = surfaceClasses({ variant, mdVariant, maxHeight });
  const closeVisibility = closeButton === 'always' ? CLOSE_ALWAYS : CLOSE_MD;

  const closeControl =
    closeButton === 'none' ? null : (
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className={`${CLOSE_BASE} ${closeVisibility} ${title === undefined ? CLOSE_FLOATING_CLASS : CLOSE_HEADER_CLASS}`}
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    );

  return (
    <>
      {scrim !== 'none' && <Scrim onClose={onClose} belowMdOnly={scrim === 'below-md'} />}
      <div id={id} role={role} aria-label={label} className={root}>
        {title === undefined ? (
          closeControl
        ) : (
          <div className={HEADER_CLASS}>
            <h2 className={TITLE_CLASS}>{title}</h2>
            {closeControl}
          </div>
        )}
        <div className={body}>{children}</div>
      </div>
    </>
  );
}
