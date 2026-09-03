import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import { ManuscriptWorkspace } from './ManuscriptWorkspace';
import { MemoryWorkspace } from '@opendraft/workspace';

// @vitest-environment jsdom

async function makeFixtureWorkspace(): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await ws.writeFile('blocks/manifest.json', JSON.stringify({
    version: '1.0.0',
    blocks: [{ id: 'intro', file: 'intro.qmd', title: 'Introduction' }],
  }));
  await ws.writeFile('blocks/intro.qmd', '<div data-section><h1>Introduction</h1><p>Hello world.</p></div>');
  return ws;
}

describe('ManuscriptWorkspace rendering', () => {
  let workspace: MemoryWorkspace;

  beforeEach(async () => {
    vi.clearAllMocks();
    workspace = await makeFixtureWorkspace();
  });

  it('renders workspace with sidebar tabs', () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    expect(screen.getAllByText('Blocks').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Metadata').length).toBeGreaterThan(0);
    expect(screen.getAllByText('References').length).toBeGreaterThan(0);
  });

  it('shows block list when Blocks tab is active', async () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    await waitFor(() => {
      expect(screen.getByText('Introduction')).toBeDefined();
    });
  });

  it('shows a placeholder when no block is selected', () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    expect(screen.getByText('Select a block')).toBeDefined();
  });

  it('opens the editor with block content when a block is selected', async () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    await waitFor(() => expect(screen.getByText('Introduction')).toBeDefined());
    fireEvent.click(screen.getByText('Introduction'));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Introduction' })).toBeDefined();
    });
    expect(screen.getByText('Hello world.')).toBeDefined();
  });
});

describe('ManuscriptWorkspace editing', () => {
  let workspace: MemoryWorkspace;

  beforeEach(async () => {
    vi.clearAllMocks();
    workspace = await makeFixtureWorkspace();
  });

  it('persists edits to the workspace file', async () => {
    let editorRef: import('@tiptap/react').Editor | null = null;
    render(
      <ManuscriptWorkspace
        workspace={workspace}
        onEditorReady={(e: import('@tiptap/react').Editor | null) => { editorRef = e; }}
      />
    );
    await waitFor(() => expect(screen.getByText('Introduction')).toBeDefined());
    fireEvent.click(screen.getByText('Introduction'));
    await waitFor(() => expect(editorRef).not.toBeNull());
    await waitFor(() => expect(editorRef!.isInitialized).toBe(true));

    await act(async () => {
      editorRef!.chain().focus('end').insertContent(' UPDATED').run();
    });

    await waitFor(async () => {
      const saved = await workspace.readFile('blocks/intro.qmd');
      expect(saved).toContain('UPDATED');
    });
  });
});

describe('ManuscriptWorkspace navigation', () => {
  let workspace: MemoryWorkspace;

  beforeEach(async () => {
    vi.clearAllMocks();
    workspace = await makeFixtureWorkspace();
  });

  it('shows a message when the manifest has no blocks', async () => {
    await workspace.deleteFile('blocks/manifest.json');
    render(<ManuscriptWorkspace workspace={workspace} />);
    await waitFor(() => expect(screen.getByText('No blocks')).toBeDefined());
  });

  it('switches to Metadata tab when clicked', async () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    fireEvent.click(screen.getAllByText('Metadata')[0]);
    await waitFor(() => {
      expect(screen.getByText('_author.yml')).toBeDefined();
    });
  });

  it('switches to References tab when clicked', async () => {
    render(<ManuscriptWorkspace workspace={workspace} />);
    fireEvent.click(screen.getAllByText('References')[0]);
    await waitFor(() => {
      expect(screen.getByText('references.bib')).toBeDefined();
    });
  });
});