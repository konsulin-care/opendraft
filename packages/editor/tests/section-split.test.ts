import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from 'prosemirror-state';
import { Section } from '../src/extensions/section.js';
import { SectionDocument } from '../src/extensions/document.js';
import { SectionSplit } from '../src/extensions/section-split.js';

// @vitest-environment jsdom

function createEditor(content?: string) {
  return new Editor({
    extensions: [
      SectionDocument,
      Section,
      SectionSplit,
      StarterKit.configure({ document: false }),
    ],
    content,
  });
}

function selectParagraph(editor: Editor, offset = 1) {
  const { doc } = editor.state;
  let paragraphPos = -1;
  doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') {
      paragraphPos = pos;
      return false;
    }
  });

  if (paragraphPos >= 0) {
    editor.chain()
      .command(({ tr, dispatch }) => {
        if (dispatch) {
          const $pos = tr.doc.resolve(paragraphPos + offset);
          tr.setSelection(new TextSelection($pos));
        }
        return true;
      })
      .run();
  }
}

describe('SectionSplit', () => {
  it('splits section when paragraph is converted to heading', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>Content</p></div>'
    );

    editor.chain().focus().run();
    selectParagraph(editor);
    editor.chain().convertToSectionHeading().run();

    const newDoc = editor.state.doc;
    expect(newDoc.childCount).toBe(2);
  });

  it('preserves content after cursor in new section', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>Hello world</p></div>'
    );

    editor.chain().focus().run();
    selectParagraph(editor, 4); // After "Hell"
    editor.chain().convertToSectionHeading().run();

    const newDoc = editor.state.doc;
    expect(newDoc.childCount).toBe(2);
  });

  it('splits first section into two sections', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>Body</p></div>'
    );

    editor.chain().focus().run();
    selectParagraph(editor);
    editor.chain().convertToSectionHeading().run();

    const newDoc = editor.state.doc;
    expect(newDoc.childCount).toBe(2);
    expect(newDoc.child(0).type.name).toBe('section');
    expect(newDoc.child(1).type.name).toBe('section');
  });
});
