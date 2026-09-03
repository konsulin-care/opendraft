import { Node } from '@tiptap/core';

/**
 * Custom Section node extension for TipTap.
 *
 * Represents a manuscript section with an H1 heading as title
 * and optional body content (paragraphs).
 */
export const Section = Node.create({
  name: 'section',

  /** Section contains a heading (required) followed by paragraphs (optional). */
  content: 'heading paragraph*',

  /** Section is a block-level node. */
  group: 'block',

  /** Enter at end creates a new section (not paragraph inside). */
  defining: true,

  /** Parse HTML div with data-section attribute. */
  parseHTML() {
    return [{ tag: 'div[data-section]' }];
  },

  /** Render as div with data-section attribute. */
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes, 0];
  },
});
