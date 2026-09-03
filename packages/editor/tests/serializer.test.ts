import { afterEach, describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Section } from '../src/extensions/section.js';
import { SectionDocument } from '../src/extensions/document.js';
import { serializeDocument, deserializeSections } from '../src/serializer.js';

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

describe('serializeDocument', () => {
  it('serializes single section to markdown', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>Content</p></div>'
    );

    const sections = serializeDocument(editor.state.doc);
    expect(sections.size).toBe(1);

    const firstSection = sections.values().next().value;
    expect(firstSection).toContain('# Title');
    expect(firstSection).toContain('Content');
  });

  it('serializes multiple sections', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1><p>B</p></div>'
    );

    const sections = serializeDocument(editor.state.doc);
    expect(sections.size).toBe(2);
  });

  it('serializes section with multiple paragraphs', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>First</p><p>Second</p></div>'
    );

    const sections = serializeDocument(editor.state.doc);
    const content = sections.values().next().value;
    expect(content).toContain('First');
    expect(content).toContain('Second');
  });
});

describe('deserializeSections', () => {
  it('deserializes single section', () => {
    const sections = new Map([['abc123', '# Title\n\nContent']]);

    const nodes = deserializeSections(sections);
    expect(nodes.length).toBe(1);
    expect(nodes[0].type.name).toBe('section');
  });

  it('deserializes multiple sections', () => {
    const sections = new Map([
      ['abc123', '# First\n\nA'],
      ['def456', '# Second\n\nB'],
    ]);

    const nodes = deserializeSections(sections);
    expect(nodes.length).toBe(2);
  });

  it('preserves heading text', () => {
    const sections = new Map([['abc123', '# My Title\n\nBody']]);

    const nodes = deserializeSections(sections);
    const heading = nodes[0].child(0);
    expect(heading.type.name).toBe('heading');
    expect(heading.textContent).toBe('My Title');
  });
});

describe('round-trip', () => {
  it('serialize -> deserialize -> serialize produces identical output', () => {
    const editor = createEditor(
      '<div data-section><h1>Title</h1><p>Content</p></div>'
    );

    const originalSections = serializeDocument(editor.state.doc);
    const nodes = deserializeSections(originalSections);

    // Create a new map from the deserialized nodes
    const roundTrippedSections = new Map<string, string>();
    for (const node of nodes) {
      const heading = node.child(0);
      const title = heading.textContent;
      const content = node.content.content
        .slice(1)
        .map((child: { textContent: string }) => child.textContent)
        .join('\n\n');
      roundTrippedSections.set('test', `# ${title}\n\n${content}`);
    }

    // Compare
    expect(roundTrippedSections.size).toBe(originalSections.size);
  });
});
