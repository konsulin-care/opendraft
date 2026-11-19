/**
 * Section graph emitter: doco:Section nodes (with optional deo: role
 * type) ordered by oco:hasNext and linked from the publication by
 * dcterms:hasPart.
 */
import { block, literalString, termRef, DCTERMS, OCO } from './turtle.js';

const DOCO = '<http://purl.org/spar/doco/';
const DEO = '<http://purl.org/spar/deo/';

/** One section to emit. */
export interface SectionInput {
  /** Short name (no underscore). */
  short: string;
  /** Kebab-case role such as `related-work`; omitted for generic sections. */
  role?: string;
  /** Section title. */
  title: string;
}

/** Input for the section graph emitter. */
export interface SectionGraphInput {
  /** Absolute publication IRI. */
  publication: string;
  /** Sections in document order. */
  sections: SectionInput[];
  /** Repository URL; dcterms:source only emitted for GitHub. */
  repositoryUrl?: string;
  /** Source revision (commit sha). */
  sourceRevision?: string;
  /** Manuscript path in the repository, e.g. manuscripts/<id>. */
  manuscriptPath?: string;
}

/**
 * Convert a kebab-case role to PascalCase.
 *
 * @param role - Kebab-case role.
 * @returns PascalCase role.
 */
export function rolePascal(role: string): string {
  return role.split('-').filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

function rawUrl(input: SectionGraphInput, short: string): string | null {
  if (!input.sourceRevision || !input.repositoryUrl) return null;
  const m = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(input.repositoryUrl);
  if (!m) return null;
  const dir = (input.manuscriptPath ?? '').replace(/^\/+|\/+$/g, '');
  const path = `${dir ? `${dir}/` : ''}blocks/_${short}.qmd`;
  return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${input.sourceRevision}/${path}`;
}

/**
 * Emit Turtle blocks for the sections and the publication hasPart links.
 *
 * @param input - Publication IRI, ordered sections and source info.
 * @returns Turtle blocks (empty when there are no sections).
 */
export function emitSectionGraph(input: SectionGraphInput): string[] {
  const { sections } = input;
  if (sections.length === 0) return [];
  const iri = (s: SectionInput): string => termRef(`${input.publication}#sec-${s.short}`);
  const out: string[] = [
    block(termRef(input.publication), [
      `${DCTERMS}hasPart> ${sections.map(iri).join(', ')}`,
    ]),
  ];
  sections.forEach((s, i) => {
    const types = [`${DOCO}Section>`];
    if (s.role) types.push(`${DEO}${rolePascal(s.role)}>`);
    const pairs = [`a ${types.join(', ')}`, `${DCTERMS}title> ${literalString(s.title)}`];
    const src = rawUrl(input, s.short);
    if (src) pairs.push(`${DCTERMS}source> ${termRef(src)}`);
    const next = sections[i + 1];
    if (next) pairs.push(`${OCO}hasNext> ${iri(next)}`);
    out.push(block(iri(s), pairs));
  });
  return out;
}
