import type { Reference } from '@opendraft/references';

/**
 * Handle click on a citekey link.
 *
 * Opens the DOI link if available, otherwise opens the URL field.
 * Does nothing if neither DOI nor URL is present.
 *
 * @param ref - The reference associated with the clicked citekey.
 */
export function handleCitekeyClick(ref: Reference): void {
  const { fields } = ref;

  if (fields.doi) {
    // Open DOI link in new tab
    window.open(`https://doi.org/${fields.doi}`, '_blank', 'noopener,noreferrer');
  } else if (fields.url) {
    // Open URL in new tab
    window.open(fields.url, '_blank', 'noopener,noreferrer');
  }
  // Do nothing if neither DOI nor URL is present
}
