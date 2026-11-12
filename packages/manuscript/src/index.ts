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
export { joinHeading, retitleHeading, splitHeading } from './heading.js';
export type { BlockHeading, SplitHeading } from './heading.js';
export {
  extendedSectionTypePresets,
  sectionTypeClass,
  sectionTypePresets,
  sectionTypeRole,
} from './deo-types.js';
export type { SectionTypePreset } from './deo-types.js';
