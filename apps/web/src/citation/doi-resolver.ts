/**
 * DOI resolution and BibTeX cleanup for citation plugin.
 */

/**
 * Normalize user input to a bare DOI string.
 *
 * Accepts raw DOIs, doi.org URLs, and arbitrary URLs containing a DOI.
 * Returns null if no DOI pattern can be extracted.
 *
 * @param input - User-entered DOI string.
 * @returns Bare DOI or null.
 */
export function normalizeDoi(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Bare DOI: starts with 10.XXXX/
  const bareMatch = trimmed.match(/^(10\.\d{4,}\/.+?)\/?$/);
  if (bareMatch) return bareMatch[1];

  // 2. doi.org URL: extract everything after doi.org/, strip query/hash/trailing slash
  const doiOrgMatch = trimmed.match(/doi\.org\/([^\s?#]+)/i);
  if (doiOrgMatch) {
    return doiOrgMatch[1].replace(/\/$/, '') || null;
  }

  // 3. Arbitrary URL: find a DOI pattern (10.XXXX/...) anywhere, stopping at query/hash/whitespace
  const anywhereMatch = trimmed.match(/(10\.\d{4,}\/[^\s?#]+)/);
  if (anywhereMatch) return anywhereMatch[1];

  return null;
}

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
