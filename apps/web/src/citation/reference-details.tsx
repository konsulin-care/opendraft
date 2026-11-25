import { isCrossrefKey } from '@opendraft/manuscript';
import type { Reference } from '@opendraft/references';
import { InlineMarkdown } from '../components/inline-markdown';
import { formatAPA } from './apa-format';

/** Warning shown when a citation key collides with a Quarto cross-reference prefix. */
export const CROSSREF_RESERVED_WARNING =
  'Prefix reserved for Quarto cross-references';

/** Props for {@link ReferenceDetails}. */
export interface ReferenceDetailsProps {
  /** The reference to describe. */
  reference: Reference;
}

/**
 * Render the APA citation body and any reserved-prefix warning for a reference.
 *
 * Shared by the citekey tooltip and the citation detail drawers.
 *
 * @param props - The reference to render.
 * @returns The reference details.
 */
export function ReferenceDetails({ reference }: ReferenceDetailsProps) {
  return (
    <>
      <InlineMarkdown source={formatAPA(reference)} inline />
      {isCrossrefKey(reference.citeKey) && (
        <div className="citation-crossref-warning">
          {CROSSREF_RESERVED_WARNING}
        </div>
      )}
    </>
  );
}
