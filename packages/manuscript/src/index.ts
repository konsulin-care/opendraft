export { normalizeShortName, uniqueShortName } from './slug.js';
export {
  addBlock,
  deleteBlock,
  extractIncludes,
  listBlocks,
  renameBlock,
  setBlockTitle,
} from './blocks.js';
export type { BlockListItem, CreateBlockDraft } from './blocks.js';
export { normalizeBlockFiles } from './normalize.js';
export type { NormalizeBlockFilesResult } from './normalize.js';
export { extractCitekeys } from './citekeys.js';
export { countSectionRefs, rewriteSectionRefs } from './section-refs.js';
export { isCrossrefKey, QUARTO_CROSSREF_PREFIXES } from './crossref-prefixes.js';
export { extractCrossrefLabels } from './crossref-labels.js';
export type { CrossrefKind, CrossrefLabel } from './crossref-labels.js';
export { joinHeading, retitleHeading, splitHeading } from './heading.js';
export type { BlockHeading, SplitHeading } from './heading.js';
export {
  extendedSectionTypePresets,
  sectionTypeClass,
  sectionTypePresets,
  sectionTypeRole,
} from './deo-types.js';
export type { SectionTypePreset } from './deo-types.js';
export { addManuscript } from './manuscripts.js';
export { isValidManuscriptId, normalizeManuscriptId } from './manuscript-id.js';
export { classifyCandidate } from './discover-candidate.js';
export type {
  CandidateLayout,
  CandidateStatus,
  CandidateWarning,
  ManuscriptCandidate,
  RejectReason,
} from './discover-candidate.js';
export { discoverProject } from './discover.js';
export type { ConfigState, ProjectDiscovery } from './discover.js';
export { OPENDRAFT_CONFIG_PATH, SHARED_BIB_PATH, scaffoldProject } from './scaffold.js';
export type { ProtocolBlock, ScaffoldOptions } from './scaffold.js';
export * from './init-plan.js';
