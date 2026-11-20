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
export { isCrossrefKey, QUARTO_CROSSREF_PREFIXES } from './crossref-prefixes.js';
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
export { OPENDRAFT_CONFIG_PATH, SHARED_BIB_PATH, scaffoldProject } from './scaffold.js';
export type { ProtocolBlock, ScaffoldOptions } from './scaffold.js';
