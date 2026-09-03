/**
 * YAML metadata parsing, validation, and compilation for OpenDraft manuscripts.
 */

export { compileManuscript } from './compiler.js';
export type { PublicationMetadata } from './compiler.js';
export { compileArticle } from './article-compiler.js';
export { migrateToBlockLayout } from './migration.js';
export type { MigrationResult } from './migration.js';

// Re-export generated types from JSON schemas
export type {
  AuthorMetadata,
  AuthorObject,
  AffiliationObject,
} from './types/author.js';
export type { AbstractMetadata } from './types/abstract.js';
export type { FrontmatterMetadata } from './types/frontmatter.js';
