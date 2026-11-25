import { Plugin } from '@milkdown/kit/prose/state';
import { $prose } from '@milkdown/kit/utils';

/**
 * ProseMirror plugin that opens a code block's source when its rendered
 * preview is clicked in an editable editor. A block shows a preview only
 * while `previewOnlyByDefault` (or the preview toggle) keeps its source
 * hidden; clicking the preview activates the block's own toggle button,
 * reusing its state and re-render path. Links inside a preview keep their
 * normal navigation. The click listener is bound to the editor view's DOM
 * and removed when the view is destroyed, so a re-created editor on the
 * same root never toggles twice.
 */
export const previewClickToEdit = $prose(
  () =>
    new Plugin({
      view(view) {
        const onClick = (event: MouseEvent): void => {
          if (!view.editable) return;
          const target = event.target instanceof Element ? event.target : null;
          if (!target || target.closest('a')) return;
          const block = target.closest('.preview-panel')?.closest('.milkdown-code-block');
          if (!block?.querySelector('.codemirror-host')?.classList.contains('hidden')) return;
          block.querySelector<HTMLButtonElement>('.preview-toggle-button')?.click();
        };
        view.dom.addEventListener('click', onClick);
        return { destroy: () => view.dom.removeEventListener('click', onClick) };
      },
    }),
);
