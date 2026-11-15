/**
 * Manuscript graph compiler: composes the publication, authorship and
 * section graphs from a manuscript snapshot as deterministic Turtle.
 */
import { normalizeDoi } from './identifiers.js';
import { compilePublicationGraph } from './publication-graph.js';
import { emitSectionGraph } from './section-graph.js';
import type { PublicationGraphInput, PublicationSubject } from './publication-graph.js';
import type { ManuscriptSnapshot } from '../snapshot.js';
import type { AuthorObject, RegistryAffiliation } from '../types/author.js';

const DEFAULT_PROTOCOL_REPO = 'https://github.com/konsulin-care/opendraft';
const ZERO_SHA = '0000000000000000000000000000000000000000';

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function strings(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : undefined;
}

function subjectOf(value: unknown): PublicationSubject | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  const text = str(v.text);
  const authority = str(v.authority);
  const term = str(v.term);
  return text && authority && term ? { text, authority, term } : undefined;
}

/**
 * Compile a manuscript snapshot into deterministic Turtle.
 *
 * @param snapshot - Parsed manuscript inputs.
 * @returns Turtle for the draft (no DOIs) or release (DOIs) graph.
 */
export function compileManuscriptGraph(snapshot: ManuscriptSnapshot): string {
  const fm = snapshot.frontmatter;
  const authorData = snapshot.author;
  const authors = (Array.isArray(authorData.authors) ? authorData.authors : []) as AuthorObject[];
  const affiliations = (Array.isArray(authorData.affiliations)
    ? authorData.affiliations : []) as RegistryAffiliation[];
  const versionDoi = normalizeDoi(snapshot.versionDoi);
  const input: PublicationGraphInput = {
    title: str(fm.title) ?? snapshot.manuscriptId,
    abstract: str(snapshot.abstract.abstract),
    keywords: strings(fm.keywords),
    license: str(fm.license),
    funding: str(fm.funding),
    subject: subjectOf(fm.subject),
    authors,
    affiliations,
    repositoryUrl: snapshot.repository,
    manuscriptId: snapshot.manuscriptId,
    manuscriptPath: snapshot.manuscriptPath,
    sourceRevision: snapshot.sourceRevision,
    protocolRepository: snapshot.protocolRepository ?? DEFAULT_PROTOCOL_REPO,
    protocolRevision: snapshot.protocolCommit ?? ZERO_SHA,
    versionDoi: snapshot.versionDoi,
    conceptDoi: snapshot.conceptDoi,
    references: strings(fm.references),
  };
  const root = versionDoi?.iri
    ?? `https://w3id.org/opendraft/draft/${snapshot.manuscriptId}`;
  const sections = emitSectionGraph({
    publication: root,
    sections: snapshot.sections.map((s) => ({
      short: s.short,
      title: s.title,
      role: s.role ?? undefined,
    })),
    repositoryUrl: snapshot.repository,
    sourceRevision: snapshot.sourceRevision,
    manuscriptPath: snapshot.manuscriptPath,
  });
  const base = compilePublicationGraph(input).trimEnd();
  return `${[base, ...sections].join('\n\n')}\n`;
}
