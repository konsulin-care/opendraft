import { Extension } from '@tiptap/core';
import type { Node } from 'prosemirror-model';
import type { RawCommands } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sectionReorder: {
      /**
       * Reorder sections in the document.
       *
       * @param fromIndex - Source section index
       * @param toIndex - Target section index
       */
      reorderSections: (fromIndex: number, toIndex: number) => ReturnType;
    };
  }
}

/** Collect all section nodes from document. */
function collectSections(doc: Node): Node[] {
  const sections: Node[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'section') {
      sections.push(node);
    }
  });
  return sections;
}

/**
 * Extension that provides section reordering functionality.
 *
 * Adds a reorderSections command that reorders sections in the document.
 */
export const SectionReorder = Extension.create({
  name: 'sectionReorder',

  addCommands() {
    return {
      reorderSections:
        (fromIndex, toIndex) =>
        ({ state, dispatch }) => {
          const { doc } = state;
          const sections = collectSections(doc);

          if (fromIndex < 0 || fromIndex >= sections.length) return false;
          if (toIndex < 0 || toIndex >= sections.length) return false;
          if (fromIndex === toIndex) return false;

          if (dispatch) {
            const tr = state.tr;

            // Calculate positions
            let pos = 0;
            const positions = sections.map((section) => {
              const start = pos;
              pos += section.nodeSize;
              return start;
            });

            // Reorder
            const reordered = [...sections];
            const [moved] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, moved);

            // Replace all sections
            const endPos = positions[positions.length - 1] + sections[sections.length - 1].nodeSize;
            tr.replaceWith(0, endPos, reordered);

            dispatch(tr);
          }

          return true;
        },
    } as Partial<RawCommands>;
  },
});
