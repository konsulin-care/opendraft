/**
 * YAML metadata parsing, validation, and compilation for OpenDraft manuscripts.
 */

export { normalizeOrcid, normalizeRor, normalizeDoi } from './rdf/identifiers.js';
export type { NormalizedIdentifier } from './rdf/identifiers.js';
export { emitAuthorshipGraph } from './rdf/authorship-graph.js';
export type { AuthorshipGraphInput } from './rdf/authorship-graph.js';
export { compilePublicationGraph } from './rdf/publication-graph.js';
export { compileManuscriptGraph } from './rdf/manuscript-graph.js';
export type { PublicationGraphInput, PublicationSubject } from './rdf/publication-graph.js';
export { compileArticle } from './article-compiler.js';
export { loadManuscriptSnapshot } from './snapshot.js';
export type {
  ManuscriptSnapshot,
  SnapshotContext,
  SnapshotEntry,
  SnapshotSection,
} from './snapshot.js';

// Re-export generated types from JSON schemas
export type {
  AuthorMetadata,
  AuthorObject,
  AffiliationObject,
  AffiliationRef,
  NameValue,
  StructuredName,
  LiteralName,
  MemberObject,
  RegistryAffiliation,
} from './types/author.js';
export type { AbstractMetadata } from './types/abstract.js';
export type { FrontmatterMetadata } from './types/frontmatter.js';
