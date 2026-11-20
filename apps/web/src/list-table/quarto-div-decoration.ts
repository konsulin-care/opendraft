import { Plugin } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { $prose } from '@milkdown/kit/utils';

/**
 * ProseMirror decoration plugin that tags every `quarto-div` code block
 * with the `quarto-div-block` class, so CSS can hide the language picker
 * and language button on those blocks.
 *
 * A fenced div is parsed into a `code_block` node whose `language`
 * attribute is `quarto-div`; the class is the only visual marker the
 * node view needs.
 */
export const quartoDivDecoration = $prose(
  () =>
    new Plugin({
      props: {
        decorations(state) {
          const decos: Decoration[] = [];
          state.doc.descendants((node, pos) => {
            if (node.type.name === 'code_block' && node.attrs['language'] === 'quarto-div') {
              decos.push(
                Decoration.node(pos, pos + node.nodeSize, { class: 'quarto-div-block' }),
              );
            }
          });
          return DecorationSet.create(state.doc, decos);
        },
      },
    }),
);
