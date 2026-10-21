export type { ValidationResult, ValidationError } from './types.js';
export { validateOpendraft } from './opendraft.js';
export { validateManuscript } from './manuscript.js';
export { validateMetadata, type MetadataType } from './metadata.js';
export { checkAuthorIntegrity } from './author-integrity.js';
export {
  resolvePublishIdentity,
  normalizeRepositoryUrl,
  type PublishIdentity,
  type PublishIdentityInput,
  type RepositoryMismatchRemedy,
} from './publish-identity.js';
export { validateManifest, validateBlockStructure } from './manifest.js';
export type { ManifestData } from './manifest.js';
export { validateAssembly, collectIncludes } from './assembly.js';
export type { AssemblyResult, AssemblyInput } from './assembly.js';
