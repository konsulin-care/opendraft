import type { Reference } from '@opendraft/references';

/**
 * Resolve the outbound link for a reference.
 *
 * Prefers the DOI URL over the raw URL field.
 *
 * @param ref - The reference to resolve.
 * @returns The DOI URL, the URL field, or `null` when neither is present.
 */
export function referenceLink(ref: Reference): string | null {
  const doi = ref.fields.doi?.trim();
  if (doi) return `https://doi.org/${doi}`;
  const url = ref.fields.url?.trim();
  return url ? url : null;
}

/**
 * Handle click on a citekey link.
 *
 * Opens the DOI link if available, otherwise opens the URL field.
 * Does nothing if neither DOI nor URL is present.
 *
 * @param ref - The reference associated with the clicked citekey.
 */
export function handleCitekeyClick(ref: Reference): void {
  const link = referenceLink(ref);
  if (link) {
    window.open(link, '_blank', 'noopener,noreferrer');
  }
}
