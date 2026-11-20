/** Detected preprint metadata for a BibTeX entry. */
export interface PreprintInfo {
  /** Canonical preprint server name, or an empty string when unknown. */
  server: string;
}

/** Fields whose values may name a preprint server. */
const PREPRINT_FIELDS = [
  'howpublished',
  'note',
  'publisher',
  'eprinttype',
  'archiveprefix',
] as const;

/** Known preprint servers with their canonical display names. */
const KNOWN_SERVERS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'arXiv', pattern: /\barxiv\b/i },
  { name: 'bioRxiv', pattern: /\bbiorxiv\b/i },
  { name: 'medRxiv', pattern: /\bmedrxiv\b/i },
  { name: 'PsyArXiv', pattern: /\bpsyarxiv\b/i },
  { name: 'SSRN', pattern: /\bssrn\b/i },
  { name: 'OSF Preprints', pattern: /\bosf(?:\s+preprints?)?\b/i },
  { name: 'Research Square', pattern: /\bresearch\s*square\b/i },
  { name: 'Preprints.org', pattern: /\bpreprints?\.org\b/i },
];

/** Known DOI prefixes and their default servers. */
const DOI_SERVERS: ReadonlyArray<{ prefix: string; server: string }> = [
  { prefix: '10.1101', server: 'bioRxiv' },
  { prefix: '10.48550', server: 'arXiv' },
  { prefix: '10.31234', server: 'PsyArXiv' },
  { prefix: '10.2139', server: 'SSRN' },
];

/** Strip common DOI decorations so only the bare DOI remains. */
function stripDoiPrefix(doi: string): string {
  return doi
    .trim()
    .replace(/^(?:doi:\s*|https?:\/\/doi\.org\/)/i, '')
    .trim();
}

/** Return the canonical server named in a field value, if any. */
function serverInText(value: string): string {
  for (const server of KNOWN_SERVERS) {
    if (server.pattern.test(value)) return server.name;
  }
  return '';
}

/** Return the first known server named in the preprint-relevant fields. */
function serverFromFields(fields: Readonly<Record<string, string>>): string {
  for (const key of PREPRINT_FIELDS) {
    const value = fields[key]?.trim();
    if (!value) continue;
    const server = serverInText(value);
    if (server) return server;
  }
  return '';
}

/** Return true when a preprint-relevant field contains the word preprint. */
function mentionsPreprint(fields: Readonly<Record<string, string>>): boolean {
  return PREPRINT_FIELDS.some((key) => /\bpreprint\b/i.test(fields[key] ?? ''));
}

/** Return true when any field mentions medRxiv, case-insensitively. */
function mentionsMedRxiv(fields: Readonly<Record<string, string>>): boolean {
  return Object.values(fields).some((value) => /medrxiv/i.test(value ?? ''));
}

/** Map a DOI to its known preprint server, or an empty string. */
function serverFromDoi(
  doi: string,
  fields: Readonly<Record<string, string>>,
): string {
  const bare = stripDoiPrefix(doi);
  for (const entry of DOI_SERVERS) {
    if (bare.startsWith(entry.prefix)) {
      if (entry.prefix === '10.1101' && mentionsMedRxiv(fields)) {
        return 'medRxiv';
      }
      return entry.server;
    }
  }
  return '';
}

/**
 * Detect whether an entry is a preprint and identify its server.
 *
 * Checks howpublished, note, publisher, eprinttype and archiveprefix for a
 * preprint marker or known server name, then falls back to known DOI prefixes.
 * The server name is returned in canonical casing with any standalone word
 * "preprint" removed.
 *
 * @param fields - BibTeX fields for the entry.
 * @returns Detected server metadata, or null when the entry is not a preprint.
 */
export function detectPreprint(
  fields: Readonly<Record<string, string>>,
): PreprintInfo | null {
  const server =
    serverFromFields(fields) || serverFromDoi(fields.doi ?? '', fields);
  if (!server && !mentionsPreprint(fields)) return null;
  return { server: server.replace(/\bpreprint\b/gi, '').trim() };
}
