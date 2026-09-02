import { Node } from '@tiptap/core';

/**
 * Custom Document node extension for TipTap.
 *
 * Overrides the default document to contain one or more sections.
 */
export const SectionDocument = Node.create({
  name: 'doc',

  /** Document is the top-level node. */
  topNode: true,

  /** Document contains one or more sections. */
  content: 'section+',
});
