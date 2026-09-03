import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionSidebar } from './SectionSidebar';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Section, SectionDocument } from '@opendraft/editor';

// @vitest-environment jsdom

function createEditor(content: string) {
  return new Editor({
    extensions: [
      SectionDocument,
      Section,
      StarterKit.configure({ document: false }),
    ],
    content,
  });
}

describe('SectionSidebar', () => {
  it('lists sections from editor', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1><p>B</p></div>'
    );

    render(<SectionSidebar editor={editor} />);

    expect(screen.getByText('First')).toBeDefined();
    expect(screen.getByText('Second')).toBeDefined();
  });

  it('highlights active section', () => {
    const editor = createEditor(
      '<div data-section><h1>First</h1><p>A</p></div>' +
      '<div data-section><h1>Second</h1><p>B</p></div>'
    );

    render(<SectionSidebar editor={editor} />);

    const items = screen.getAllByRole('listitem');
    expect(items[0].className).toContain('active');
  });
});
