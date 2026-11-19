// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
  LIST_TABLE_PLACEHOLDER,
  listTablePlaceholder,
} from './list-table-placeholder';

let view: EditorView | null = null;

/**
 * Mount an editor with the placeholder extension over a document.
 *
 * @param doc - Initial document text.
 * @returns The mounted editor view.
 */
function mount(doc: string): EditorView {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  view = new EditorView({
    state: EditorState.create({ doc, extensions: [listTablePlaceholder] }),
    parent,
  });
  return view;
}

/**
 * Find the offset of the blank body line after a list-table opening fence.
 *
 * @param doc - The document text.
 * @returns The offset of the first blank body line.
 */
function blankBodyOffset(doc: string): number {
  return doc.indexOf('\n\n') + 1;
}

afterEach(() => {
  view?.destroy();
  view = null;
  document.body.innerHTML = '';
});

describe('listTablePlaceholder', () => {
  it('shows the placeholder widget on the blank body line of ::: {.list-table} followed by a blank line and ::: while the document text excludes the placeholder', () => {
    const doc = '::: {.list-table}\n\n:::';
    const editor = mount(doc);

    const widget = editor.dom.querySelector('.cm-list-table-placeholder');
    expect(widget).not.toBeNull();
    expect(widget?.textContent).toBe(LIST_TABLE_PLACEHOLDER);
    expect(editor.state.doc.toString()).not.toContain(LIST_TABLE_PLACEHOLDER);
    expect(editor.state.doc.toString()).toBe(doc);
  });

  it('removes the placeholder once a character is typed in the body but keeps it when only the opening fence line is edited', () => {
    const doc = '::: {.list-table}\n\n:::';
    const editor = mount(doc);

    const openingBrace = doc.indexOf('{');
    editor.dispatch({
      changes: { from: openingBrace + 1, insert: ' #tbl-example' },
    });
    expect(editor.dom.querySelector('.cm-list-table-placeholder')).not.toBeNull();

    const bodyOffset = blankBodyOffset(editor.state.doc.toString());
    editor.dispatch({ changes: { from: bodyOffset, insert: 'Caption' } });
    expect(editor.dom.querySelector('.cm-list-table-placeholder')).toBeNull();
  });

  it('shows no placeholder for non-list-table divs, list-tables with content, or text outside divs', () => {
    const nonListTable = mount('::: {.callout-note}\n\n:::');
    expect(
      nonListTable.dom.querySelector('.cm-list-table-placeholder'),
    ).toBeNull();
    nonListTable.destroy();
    view = null;

    const withContent = mount(
      '::: {.list-table}\n\n- - Cell 1\n  - Cell 2\n:::',
    );
    expect(
      withContent.dom.querySelector('.cm-list-table-placeholder'),
    ).toBeNull();
    withContent.destroy();
    view = null;

    const plainText = mount('Just some text.');
    expect(
      plainText.dom.querySelector('.cm-list-table-placeholder'),
    ).toBeNull();
  });
});
