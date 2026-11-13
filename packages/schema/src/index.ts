export type { ValidationResult, ValidationError } from './types.js';
export { validateOpendraft } from './opendraft.js';
export { validateManuscript } from './manuscript.js';
export { validateMetadata, type MetadataType } from './metadata.js';
export { checkAuthorIntegrity } from './author-integrity.js';
export { checkMetadata } from './check-metadata.js';
export { isGroupAuthor } from './author-type.js';
export {
  resolvePublishIdentity,
  normalizeRepositoryUrl,
  type PublishIdentity,
  type PublishIdentityInput,
  type RepositoryMismatchRemedy,
} from './publish-identity.js';
export {
  checkPublishReadiness,
  EMAIL_PATTERN,
  type PublishIssue,
  type PublishIssueLevel,
  type PublishFileKey,
  type PublishReadinessInput,
} from './publish-profile.js';
export { validateManifest, validateBlockStructure } from './manifest.js';
export type { ManifestData } from './manifest.js';
export { validateAssembly, collectIncludes } from './assembly.js';
export type { AssemblyResult, AssemblyInput } from './assembly.js';
export {
  MANUSCRIPT_ID_PATTERN,
  SHORT_NAME_PATTERN,
  BLOCK_INCLUDE_RE,
  SECTION_ROLES,
  blockFileName,
  parseBlockFileName,
  legacyBlockShort,
  includeLine,
  sectionAnchor,
  sectionClass,
} from './naming.js';
