/**
 * Metadata compiler for OpenDraft manuscripts.
 * Reads YAML files and optional BibTeX, validates, and returns normalized metadata.
 */

/** Normalized publication metadata output. */
export interface PublicationMetadata {
  /** Author metadata. */
  authors: AuthorMetadata[];
  /** Abstract text. */
  abstract: string;
  /** Article title. */
  title: string;
  /** Publication date. */
  date?: string;
  /** Keywords. */
  keywords?: string[];
  /** Bibliographic references. */
  references?: ReferenceMetadata[];
}

interface AuthorMetadata {
  name: string;
  email?: string;
  orcid?: string;
  affiliations?: { name: string }[];
}

interface ReferenceMetadata {
  citeKey: string;
  entryType: string;
  fields: Record<string, string>;
}

/**
 * Compile manuscript metadata from a directory.
 *
 * @param _dir - Path to manuscript directory.
 * @returns Normalized publication metadata.
 */
export function compileManuscript(_dir: string): PublicationMetadata {
  throw new Error('Not implemented');
}
