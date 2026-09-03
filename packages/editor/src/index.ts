export {
  buildManuscriptSchema,
} from './milkdown/manuscript-schema.js';
export { createManuscriptRemark } from './milkdown/manuscript-remark.js';
export {
  serializeManuscript,
  parseManuscript,
  createManuscriptDoc,
  wholeDocMarkdown,
  applyDraftFlags,
} from './milkdown/manuscript-sync.js';
export { ensureSectionIds, renameBlock, collectSectionIds } from './milkdown/identity.js';
export {
  setDraft,
  reorderBlock,
  splitSection,
  mergeSection,
  extractBlocks,
} from './milkdown/block-ops.js';
export { clearFocus, focusSection, focusedSectionId, dimmedSectionIds } from './milkdown/focus.js';
export type { FocusState } from './milkdown/focus.js';
export type { BlockOpResult, ExtractedBlockResult } from './milkdown/block-ops.js';
export type { Node } from '@milkdown/kit/prose/model';
export type { SerializedManuscript, ManuscriptInput, ParsedManuscript } from './milkdown/manuscript-sync.js';