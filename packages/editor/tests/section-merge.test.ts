import { afterEach, describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from 'prosemirror-state';
import { Section } from '../src/extensions/section.js';
import { SectionDocument } from '../src/extensions/document.js';
import { SectionMerge } from '../src/extensions/section-merge.js';

// @vitest-environment jsdom

const editors: Editor[] = [];

afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors.length = 0;
});

function createEditor(content?: string) {
  const editor = new Editor({
    extensions: [
      SectionDocument,
      Section,
      SectionMerge,
      StarterKit.configure({ document: false }),
    ],
    content,
  });

  editors.push(editor);
  return editor;
}

function selectFirstHeading(editor: Editor) {
  const { doc } = editor.state;
  let headingPos = -1;
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      headingPos = pos;
      return false;
    }
  });

  if (headingPos >= 0) {
    editor.chain()
      .command(({ tr, dispatch }) => {
        if (dispatch) {
          const $pos = tr.doc.resolve(headingPos + 1);
          tr.setSelection(new TextSelection($pos));
        }
        return true;
      })
      .run();
  }
}

describe('SectionMerge', () => {
  it('merges section into previous when H1 is deleted', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1><p>B</p></div>'
    );

    editor.chain().focus().run();
    selectFirstHeading(editor);
    editor.chain().mergeSectionWithPrevious().run();

    const newDoc = editor.state.doc;
    expect(newDoc.childCount).toBe(1);
  });

  it('does not merge first section (no previous)', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>'
    );

    editor.chain().focus().run();
    selectFirstHeading(editor);
    editor.chain().mergeSectionWithPrevious().run();

    const newDoc = editor.state.doc;
    expect(newDoc.childCount).toBe(1);
  });

  it('removes empty section after merge', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1></div>'
    );

    editor.chain().focus().run();
    selectFirstHeading(editor);
    editor.chain().mergeSectionWithPrevious().run();

    const newDoc = editor.state.doc;
    expect(newDoc.childCount).toBe(1);
  });
});
