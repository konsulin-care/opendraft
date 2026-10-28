/**
 * Canonical identifier normalization for ORCID, ROR and DOI.
 *
 * Produces canonical https IRIs (bare host, no trailing slash) and the
 * literal values carried by OCDM datacite:hasIdentifier nodes
 * (literal:hasLiteralValue).
 */

/** Canonical identifier pair: https IRI plus OCDM literal value. */
export interface NormalizedIdentifier {
  /** Canonical https IRI for the identifier. */
  iri: string;
  /** Literal value for OCDM literal:hasLiteralValue. */
  value: string;
}

/** Crossref-style DOI syntax (as used by opendraft.schema.json). */
const DOI_PATTERN = /^10\.[0-9]{4,9}\/[-._;()/:A-Za-z0-9]+$/;

/** ROR organization ids are exactly nine lowercase alphanumeric characters. */
const ROR_ID_PATTERN = /^[0-9a-z]{9}$/;

/**
 * Compute the ISO 7064 MOD 11-2 check character for an ORCID prefix.
 *
 * @param first15 - The first 15 decimal digits of the ORCID iD.
 * @returns The check character, '0'-'9' or 'X'.
 */
function orcidCheckDigit(first15: string): string {
  let total = 0;
  for (const ch of first15) {
    total = (total + Number(ch)) * 2;
  }
  const result = (12 - (total % 11)) % 11;
  return result === 10 ? 'X' : String(result);
}

/**
 * Normalize an ORCID iD to its canonical https IRI and hyphenated value.
 *
 * Accepts bare digits, hyphenated forms and orcid.org resolver URLs.
 * Checksum-invalid input is rejected.
 *
 * @param input - Raw ORCID input from YAML or a pasted URL.
 * @returns The canonical identifier, or null when the input is not a
 *   checksum-valid 16-digit ORCID iD.
 */
export function normalizeOrcid(input: unknown): NormalizedIdentifier | null {
  if (typeof input !== 'string') return null;
  const digits = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?orcid\.org\//i, '')
    .replace(/^orcid:/i, '')
    .replace(/[-\s]/g, '');
  if (!/^\d{15}[\dX]$/.test(digits)) return null;
  if (digits[15].toUpperCase() !== orcidCheckDigit(digits.slice(0, 15))) return null;
  const value = `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}`;
  return { iri: `https://orcid.org/${value}`, value };
}

/**
 * Normalize a ROR id or resolver URL to its canonical https IRI.
 *
 * @param input - Raw ROR input: bare id, ror.org URL, any scheme/host.
 * @returns The canonical IRI (e.g. https://ror.org/0116zj450), or null when
 *   the input does not contain a valid 9-character ROR id.
 */
export function normalizeRor(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const id = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?ror\.org\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase();
  if (!ROR_ID_PATTERN.test(id)) return null;
  return `https://ror.org/${id}`;
}

/**
 * Normalize a DOI to its canonical https IRI and lowercased value.
 *
 * Accepts bare DOIs, doi: prefixed strings and doi.org resolver URLs.
 *
 * @param input - Raw DOI input from YAML, a citation or a pasted URL.
 * @returns The canonical identifier, or null when the input is not a
 *   syntactically valid DOI.
 */
export function normalizeDoi(input: unknown): NormalizedIdentifier | null {
  if (typeof input !== 'string') return null;
  const doi = input
    .trim()
    .replace(/^(?:https?:\/\/)?(?:dx\.)?(?:www\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .toLowerCase();
  if (!DOI_PATTERN.test(doi)) return null;
  return { iri: `https://doi.org/${doi}`, value: doi };
}
