/**
 * Metadata compiler for OpenDraft manuscripts.
 * Reads YAML files and optional BibTeX, validates, and returns normalized metadata.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { validateMetadata, type MetadataType } from '@opendraft/schema';
import { parseBibTeX } from '../../references/src/parser.js';
import type { Reference } from '../../references/src/parser.js';

/** Normalized publication metadata output. */
export interface PublicationMetadata {
  /** Article title. */
  title: string;
  /** Abstract text. */
  abstract: string;
  /** Author metadata. */
  authors: AuthorMetadata[];
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

const REQUIRED_FILES = ['_author.yml', '_abstract.yml', '_frontmatter.yml'] as const;

/**
 * Read and parse a YAML file, validating against schema.
 */
function readAndValidateYaml(
  dir: string,
  filename: string,
  type: MetadataType,
): Record<string, unknown> {
  const filePath = join(dir, filename);
  if (!existsSync(filePath)) {
    throw new Error(`Missing required file: ${filename}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const data = parseYaml(content);

  const result = validateMetadata(data, type);
  if (!result.valid) {
    const errors = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Invalid ${filename}: ${errors}`);
  }

  return data as Record<string, unknown>;
}

/**
 * Extract and normalize author data.
 */
function extractAuthors(data: Record<string, unknown>): AuthorMetadata[] {
  const authors = (data.authors ?? data.author) as Array<Record<string, unknown>>;
  if (!Array.isArray(authors) || authors.length === 0) {
    throw new Error('No authors found in _author.yml');
  }

  return authors
    .map((a) => ({
      name: a.name as string,
      email: a.email as string | undefined,
      orcid: a.orcid as string | undefined,
      affiliations: Array.isArray(a.affiliations)
        ? (a.affiliations as Array<{ name: string }>)
        : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Read and parse BibTeX references if present.
 */
function readReferences(dir: string): ReferenceMetadata[] | undefined {
  const bibPath = join(dir, 'references.bib');
  if (!existsSync(bibPath)) {
    return undefined;
  }

  const content = readFileSync(bibPath, 'utf-8');
  const refs: Reference[] = parseBibTeX(content);

  return refs
    .map((r) => ({
      citeKey: r.citeKey,
      entryType: r.entryType,
      fields: r.fields,
    }))
    .sort((a, b) => a.citeKey.localeCompare(b.citeKey));
}

/**
 * Sort object keys recursively for deterministic output.
 */
function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce((sorted, key) => {
        (sorted as Record<string, unknown>)[key] = sortKeys(
          (obj as Record<string, unknown>)[key],
        );
        return sorted;
      }, {} as Record<string, unknown>);
  }
  return obj;
}

/**
 * Compile manuscript metadata from a directory.
 *
 * @param dir - Path to manuscript directory.
 * @returns Normalized publication metadata.
 * @throws {Error} If required files are missing or validation fails.
 */
export function compileManuscript(dir: string): PublicationMetadata {
  // Validate required files exist
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(dir, file))) {
      throw new Error(`Missing required file: ${file}`);
    }
  }

  // Read and validate YAML files
  const authorData = readAndValidateYaml(dir, '_author.yml', 'author');
  const abstractData = readAndValidateYaml(dir, '_abstract.yml', 'abstract');
  const frontmatterData = readAndValidateYaml(dir, '_frontmatter.yml', 'frontmatter');

  // Extract authors
  const authors = extractAuthors(authorData);

  // Extract abstract
  const abstract = abstractData.abstract as string;

  // Extract frontmatter
  const title = frontmatterData.title as string;
  const date = frontmatterData.date as string | undefined;
  const keywords = Array.isArray(frontmatterData.keywords)
    ? (frontmatterData.keywords as string[])
    : undefined;

  // Read references (optional)
  const references = readReferences(dir);

  const metadata: PublicationMetadata = {
    title,
    abstract,
    authors,
    date,
    keywords,
    references,
  };

  // Return with sorted keys for deterministic output
  return sortKeys(metadata) as PublicationMetadata;
}
