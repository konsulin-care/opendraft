import { afterEach, describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Section } from '../src/extensions/section.js';
import { SectionDocument } from '../src/extensions/document.js';

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
      StarterKit.configure({ document: false }),
    ],
    content,
  });

  editors.push(editor);
  return editor;
}

describe('Section node extension', () => {
  it('creates editor with empty document containing one section', () => {
    const editor = createEditor();
    const doc = editor.state.doc;

    expect(doc.type.name).toBe('doc');
    expect(doc.childCount).toBe(1);
    expect(doc.child(0).type.name).toBe('section');
  });

  it('renders section with heading and paragraph', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>Content</p></div>'
    );
    const doc = editor.state.doc;

    expect(doc.childCount).toBe(1);
    const section = doc.child(0);
    expect(section.type.name).toBe('section');
    expect(section.childCount).toBe(2);
    expect(section.child(0).type.name).toBe('heading');
    expect(section.child(1).type.name).toBe('paragraph');
  });

  it('renders multiple sections', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1><p>B</p></div>'
    );
    const doc = editor.state.doc;

    expect(doc.childCount).toBe(2);
    expect(doc.child(0).child(0).type.name).toBe('heading');
    expect(doc.child(1).child(0).type.name).toBe('heading');
  });
});

describe('Section heading', () => {
  it('defaults to level 1', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1></div>'
    );
    const section = editor.state.doc.child(0);
    const heading = section.child(0);

    expect(heading.type.name).toBe('heading');
    expect(heading.attrs.level).toBe(1);
  });

  it('allows paragraph content after heading', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>First</p><p>Second</p></div>'
    );
    const section = editor.state.doc.child(0);

    expect(section.childCount).toBe(3);
    expect(section.child(1).type.name).toBe('paragraph');
    expect(section.child(2).type.name).toBe('paragraph');
  });
});
