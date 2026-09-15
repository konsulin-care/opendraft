/**
 * DOI resolution and BibTeX cleanup for citation plugin.
 */

/**
 * Clean up BibTeX entry fetched from DOI.
 *
 * Fixes:
 * - Replace en dashes (U+2013) with -- in pages field
 * - Escape unescaped ampersands
 * - Remove url field
 * - Remove ISSN field
 *
 * @param bibtex - Raw BibTeX string from DOI.
 * @returns Cleaned BibTeX string.
 */
export function cleanupBibtex(bibtex: string): string {
  let result = bibtex;

  // Replace en dashes with -- in pages field
  result = result.replace(/(pages\s*=\s*\{[^}]*?)\u2013/g, '$1--');

  // Escape unescaped ampersands (but not already escaped ones)
  // Match & not preceded by backslash
  result = result.replace(/([^\\])&/g, '$1\\&');

  // Remove url field (handles inline and line-by-line)
  result = result.replace(/,?\s*url\s*=\s*\{[^}]*\}/g, '');

  // Remove ISSN field (handles inline and line-by-line)
  result = result.replace(/,?\s*ISSN\s*=\s*\{[^}]*\}/g, '');

  // Clean up trailing comma before closing brace
  result = result.replace(/,\s*\}/g, '}');

  return result;
}

/**
 * Resolve a DOI to BibTeX via content negotiation.
 *
 * Uses the doi.org content negotiation endpoint to fetch
 * BibTeX directly from Crossref/DataCite.
 *
 * @param doi - The DOI to resolve (e.g., "10.1234/test").
 * @returns Cleaned BibTeX string.
 * @throws {Error} If the DOI cannot be resolved.
 */
export async function resolveDoi(doi: string): Promise<string> {
  const response = await fetch(`https://doi.org/${doi}`, {
    headers: {
      'Accept': 'application/x-bibtex',
    },
  });

  if (!response.ok) {
    throw new Error(`DOI not found (${response.status})`);
  }

  const bibtex = await response.text();
  return cleanupBibtex(bibtex);
}
