// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { getMarkdown } from '@milkdown/kit/utils';
import {
  registerBlockEditor,
  focusBlockEditor,
  fulfillPendingFocus,
  requestFocusForShort,
} from './caret-mode-switch';
import { useEditorCommands } from './hooks/useEditorCommands';

const DOC = '# Title\n\nFirst paragraph.\n\nLast paragraph here.\n';

/** Source view getter with no source surface mounted. */
const noSourceView = () => null;

/** Unregister handles for every editor a test registers. */
const registrations: Array<() => void> = [];

/**
 * Mount a bare commonmark editor on the document and enroll it in the
 * block-editor registry, the way crepe-config's useEditorWiring does for
 * a mounted block.
 *
 * @param markdown - Initial document markdown.
 * @returns The created Milkdown editor.
 */
async function mountBlockEditor(markdown: string = DOC): Promise<Editor> {
  const root = document.createElement('div');
  document.body.appendChild(root);
  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(rootCtx, root);
      ctx.set(defaultValueCtx, markdown);
    })
    .use(commonmark)
    .create();
  registrations.push(registerBlockEditor(editor));
  return editor;
}

/** Serialized markdown of an editor. */
function markdownOf(editor: Editor): string {
  return editor.action(getMarkdown());
}

afterEach(() => {
  cleanup();
  for (const unregister of registrations.splice(0)) unregister();
  document.body.innerHTML = '';
});

describe('toolbar commands target the focused block editor', () => {
  it('dispatches commands to the most recently focused block editor', async () => {
    const first = await mountBlockEditor();
    const second = await mountBlockEditor('# Second\n\nOther text.\n');
    const { result } = renderHook(() => useEditorCommands('wysiwyg', noSourceView));
    const pm = first.action((ctx) => ctx.get(editorViewCtx)).dom as HTMLElement;
    expect(pm.classList.contains('ProseMirror')).toBe(true);
    // The focus pointer picks the target (crepe-config wires focusin to it).
    focusBlockEditor(first);
    const beforeFirst = markdownOf(first);
    const beforeSecond = markdownOf(second);
    act(() => result.current.insertCitation());
    expect(markdownOf(first)).not.toBe(beforeFirst);
    expect(markdownOf(second)).toBe(beforeSecond);
  }, 20000);

  it('treats commands as no-ops while no block editor is registered', () => {
    const { result } = renderHook(() => useEditorCommands('wysiwyg', noSourceView));
    act(() => {
      result.current.toggleBold();
      result.current.setHeading(1);
    });
    expect(result.current.activeState()).toMatchObject({ bold: false, heading: 0 });
  }, 20000);
});

describe('pending focus handshake', () => {
  it('focuses only the body whose short matches the pending request', async () => {
    const other = await mountBlockEditor('# Other\n\nBody.\n');
    requestFocusForShort('methods');
    // A concurrent lazy-mount with another short must not steal the request.
    fulfillPendingFocus(other, 'intro');
    const surface = other.action((ctx) => ctx.get(editorViewCtx)).dom as HTMLElement;
    expect(surface.contains(document.activeElement)).toBe(false);
    // The request survives the mismatch and focuses the matching body.
    fulfillPendingFocus(other, 'methods');
    expect(surface.contains(document.activeElement)).toBe(true);
  }, 20000);
});
