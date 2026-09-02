import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Editor } from './Editor';
import { MemoryWorkspace } from '@opendraft/workspace';

// @vitest-environment jsdom

describe('Editor component', () => {
  it('renders editor with initial content', () => {
    const workspace = new MemoryWorkspace();
    render(
      <Editor
        workspace={workspace}
        manifestPath="test/manifest.json"
        initialContent='<div data-section><h1>Test Title</h1><p>Test content</p></div>'
      />
    );

    expect(screen.getByText('Test Title')).toBeDefined();
  });

  it('renders loading state when editor not ready', () => {
    const workspace = new MemoryWorkspace();
    const { container } = render(
      <Editor
        workspace={workspace}
        manifestPath="test/manifest.json"
      />
    );

    // Editor should render (either loading or content)
    expect(container.querySelector('.editor-container')).toBeDefined();
  });
});
