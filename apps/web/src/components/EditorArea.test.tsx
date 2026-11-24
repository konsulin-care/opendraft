import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { EditorArea } from './EditorArea';
import type { EditorAreaProps } from './EditorArea';

// @vitest-environment jsdom

vi.mock('./ManuscriptEditor', () => ({
  ManuscriptEditor: ({ defaultValue, path }: { defaultValue: string; path: string }) => (
    <div data-testid="manuscript-editor">
      {path}:{defaultValue}
    </div>
  ),
}));

vi.mock('./ManuscriptView', () => ({
  ManuscriptView: ({ dir }: { dir: string }) => <div data-testid="manuscript-view">{dir}</div>,
}));

/**
 * Build EditorArea props over a fresh in-memory workspace.
 *
 * @param overrides - Props to replace on the defaults.
 * @returns Complete EditorArea props.
 */
function props(overrides: Partial<EditorAreaProps> = {}): EditorAreaProps {
  return {
    workspace: new MemoryWorkspace(),
    activePath: 'manuscripts/paper/article.qmd',
    isDir: false,
    file: null,
    projectId: 'project-1',
    onSaveStatusChange: vi.fn(),
    formattingToolbar: false,
    openFile: vi.fn(),
    ...overrides,
  };
}

describe('EditorArea', () => {
  it('renders ManuscriptEditor with the file text once its lazy chunk resolves', async () => {
    render(
      <EditorArea
        {...props({
          file: { path: 'manuscripts/paper/article.qmd', text: '# Loaded body' },
        })}
      />,
    );

    expect(screen.queryByTestId('manuscript-editor')).toBeNull();
    const editor = await screen.findByTestId('manuscript-editor');
    expect(editor.textContent).toBe('manuscripts/paper/article.qmd:# Loaded body');
  });

  it('renders ManuscriptView synchronously without loading ManuscriptEditor', () => {
    render(
      <EditorArea
        {...props({
          activePath: 'manuscripts/paper',
          isDir: true,
        })}
      />,
    );

    expect(screen.getByTestId('manuscript-view').textContent).toBe('manuscripts/paper');
    expect(screen.queryByTestId('manuscript-editor')).toBeNull();
  });
});
