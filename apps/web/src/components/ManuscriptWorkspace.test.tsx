import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ManuscriptWorkspace } from './ManuscriptWorkspace';
import { MemoryWorkspace } from '@opendraft/workspace';

// @vitest-environment jsdom

describe('ManuscriptWorkspace', () => {
  let workspace: MemoryWorkspace;

  beforeEach(async () => {
    vi.clearAllMocks();
    workspace = new MemoryWorkspace();
    await workspace.writeFile('blocks/manifest.json', JSON.stringify({
      version: '1.0.0',
      blocks: [{ id: 'intro', file: 'intro.qmd', title: 'Introduction' }],
    }));
    await workspace.writeFile('blocks/intro.qmd', '# Introduction\n\nHello world.');
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
