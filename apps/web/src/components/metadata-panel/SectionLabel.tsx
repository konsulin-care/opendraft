/**
 * Shared small-caps section label for the metadata article view.
 *
 * Every article section heading (Abstract, Keywords, Contributions and
 * Publication details) renders through this component so the
 * all-small-caps treatment stays consistent and testable via the shared
 * `section-label` test id.
 */
import type { ReactNode } from 'react';

/** Utility classes of the shared small-caps section label. */
const CLASSES = 'font-medium [font-variant-caps:all-small-caps]';

/** Props for {@link SectionLabel}. */
export interface SectionLabelProps {
  /** Heading text or extra content of the label. */
  children: ReactNode;
  /** Extra classes appended after the shared label classes. */
  className?: string;
}

/**
 * Render a small-caps section label.
 *
 * @param props - See {@link SectionLabelProps}.
 * @returns A span carrying the shared all-small-caps classes and the
 * `section-label` test id.
 */
export function SectionLabel({ children, className }: SectionLabelProps): ReactNode {
  return (
    <span data-testid="section-label" className={className ? `${CLASSES} ${className}` : CLASSES}>
      {children}
    </span>
  );
}
