import { Extension } from '@tiptap/core';
import type { Node } from 'prosemirror-model';
import type { RawCommands } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sectionMerge: {
      /**
       * Merge the current section with the previous section.
       * Used when deleting an H1 at the start of a section.
       */
      mergeSectionWithPrevious: () => ReturnType;
    };
  }
}

/** Find the section node depth for a given resolved position. */
function findSectionDepth($from: { node: (depth: number) => { type: { name: string } }; depth: number }): number {
  for (let depth = $from.depth; depth >= 0; depth--) {
    if ($from.node(depth).type.name === 'section') {
      return depth;
    }
  }
  return -1;
}

/** Build merged content from two sections. */
function buildMergedContent(prevSection: Node, currentSection: Node): Node[] {
  const mergedContent: Node[] = [];

  // Add all children from previous section (skip its heading)
  for (let i = 0; i < prevSection.childCount; i++) {
    mergedContent.push(prevSection.child(i));
  }

  // Add all children from current section (skip its heading)
  for (let i = 1; i < currentSection.childCount; i++) {
    mergedContent.push(currentSection.child(i));
  }

  return mergedContent;
}

/** Calculate section position in document. */
function getSectionPos(doc: Node, sectionIndex: number): number {
  let pos = 0;
  for (let i = 0; i < sectionIndex; i++) {
    pos += doc.child(i).nodeSize;
  }
  return pos;
}

/**
 * Extension that provides section merging functionality.
 *
 * Adds a mergeSectionWithPrevious command that:
 * 1. Merges the current section's body into the previous section
 * 2. Removes the empty section after merge
 */
export const SectionMerge = Extension.create({
  name: 'sectionMerge',

  addCommands() {
    return {
      mergeSectionWithPrevious:
        () =>
        ({ state, dispatch }) => {
          const { selection, doc } = state;
          const { $from } = selection;

          const sectionDepth = findSectionDepth($from);
          if (sectionDepth < 0) return false;

          const sectionIndex = doc.resolve($from.before(sectionDepth)).index(0);

          // Can't merge first section
          if (sectionIndex <= 0) return false;

          const currentSection = $from.node(sectionDepth);
          const prevSection = doc.child(sectionIndex - 1);

          const prevSectionPos = getSectionPos(doc, sectionIndex - 1);
          const currentSectionPos = prevSectionPos + prevSection.nodeSize;

          const mergedContent = buildMergedContent(prevSection, currentSection);
          const sectionType = prevSection.type;
          const mergedSection = mergedContent.length > 0
            ? sectionType.create(null, mergedContent)
            : sectionType.create(null, [state.schema.node('paragraph')]);

          if (dispatch) {
            const tr = state.tr;
            tr.replaceWith(prevSectionPos, currentSectionPos + currentSection.nodeSize, [mergedSection]);

            const $newPos = tr.doc.resolve(prevSectionPos + 1);
            tr.setSelection(TextSelection.near($newPos));
            dispatch(tr);
          }

          return true;
        },
    } as Partial<RawCommands>;
  },
});
