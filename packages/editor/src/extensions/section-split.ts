import { Extension } from '@tiptap/core';
import type { Node, Fragment } from 'prosemirror-model';
import type { RawCommands } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sectionSplit: {
      /**
       * Convert the current paragraph to a section heading, splitting the section.
       */
      convertToSectionHeading: () => ReturnType;
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

/** Get the absolute index of the cursor's parent within the section. */
function getParagraphIndex(
  $from: { index: (depth: number) => number },
  sectionDepth: number
): number {
  return $from.index(sectionDepth);
}

/** Build two sections from the original section, splitting at the paragraph index. */
function buildSplitSections(
  sectionNode: Node,
  paragraphIndex: number,
  paragraphContent: Fragment
): { first: Node; second: Node } {
  const contentBefore: Node[] = [];
  const contentAfter: Node[] = [];

  for (let i = 0; i < sectionNode.childCount; i++) {
    const child = sectionNode.child(i);
    if (i < paragraphIndex) {
      contentBefore.push(child);
    } else if (i === paragraphIndex) {
      const heading = sectionNode.type.schema.node('heading', { level: 1 }, paragraphContent);
      contentAfter.push(heading);
    } else {
      contentAfter.push(child);
    }
  }

  const sectionType = sectionNode.type;
  const first = contentBefore.length > 0
    ? sectionType.create(null, contentBefore)
    : sectionType.create(null, [sectionNode.type.schema.node('paragraph')]);
  const second = sectionType.create(null, contentAfter);

  return { first, second };
}

/**
 * Extension that provides section splitting functionality.
 *
 * Adds a convertToSectionHeading command that:
 * 1. Takes the current paragraph content
 * 2. Creates a new section with that content as H1
 * 3. Splits the document appropriately
 */
export const SectionSplit = Extension.create({
  name: 'sectionSplit',

  addCommands() {
    return {
      convertToSectionHeading:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const { $from } = selection;

          const sectionDepth = findSectionDepth($from);
          if (sectionDepth < 0) return false;

          const sectionNode = $from.node(sectionDepth);
          const sectionPos = $from.before(sectionDepth);

          const paragraphNode = $from.parent;
          if (paragraphNode.type.name !== 'paragraph') return false;

          const paragraphIndex = getParagraphIndex($from, sectionDepth);
          const { first, second } = buildSplitSections(
            sectionNode,
            paragraphIndex,
            paragraphNode.content
          );

          if (dispatch) {
            const tr = state.tr;
            tr.replaceWith(sectionPos, sectionPos + sectionNode.nodeSize, [first, second]);

            const newSectionPos = sectionPos + first.nodeSize + 1;
            const $newPos = tr.doc.resolve(newSectionPos);
            tr.setSelection(TextSelection.near($newPos));

            dispatch(tr);
          }

          return true;
        },
    } as Partial<RawCommands>;
  },
});
