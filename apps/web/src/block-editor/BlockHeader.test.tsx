// @vitest-environment jsdom
/**
 * BlockHeader tests: the level-1 warning badge driven by reportLoadedBody
 * and the inline title rename wired to useBlocks().setTitle — editing the
 * header title and saving rewrites only the heading title in the block
 * file while the anchor and file name stay unchanged. Pure render — no
 * Milkdown mount.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockHeader, reportLoadedBody } from './BlockHeader';
import type { BlockHeaderProps } from './BlockHeader';
import { useBlocks } from './use-blocks';

/** Manuscript directory used by the rename fixture. */
const DIR = 'manuscripts/demo';

/**
 * Render the header with fixture props for a block.
 *
 * @param short - Block short name the header belongs to.
 * @param overrides - Prop values replacing the fixture defaults.
 * @returns The render result.
 */
function renderHeader(short: string, overrides: Partial<BlockHeaderProps> = {}) {
  const props: BlockHeaderProps = {
    short,
    title: 'Methods',
    collapsed: false,
    onToggle: vi.fn(),
    wordCount: 42,
    saveStatus: 'saved',
    ...overrides,
  };
  return render(<BlockHeader {...props} />);
}

describe('BlockHeader level-1 warning badge', () => {
  it('renders the badge when the reported body contains a level-1 heading', () => {
    reportLoadedBody('methods', 'Some intro.\n\n# Legacy heading\n\nMore text.');

    renderHeader('methods');

    expect(screen.getByTestId('level-1-warning-badge')).toBeInTheDocument();
  });

  it('leaves the badge absent when the reported body has no level-1 heading', () => {
    reportLoadedBody('methods', 'Some intro.\n\n## Level two heading\n');

    renderHeader('methods');

    expect(screen.queryByTestId('level-1-warning-badge')).not.toBeInTheDocument();
  });
});

describe('BlockHeader title rename', () => {
  it('saves the edited title through onTitleSave when the user commits with Enter', () => {
    const onTitleSave = vi.fn();
    renderHeader('intro', { title: 'Introduction', onTitleSave });

    const input = screen.getByTestId('block-title');
    fireEvent.change(input, { target: { value: 'Background' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onTitleSave).toHaveBeenCalledTimes(1);
    expect(onTitleSave).toHaveBeenCalledWith('Background');
  });

  it('rewrites only the heading title in the block file, leaving anchor and file name unchanged', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(
      `${DIR}/article.qmd`,
      '---\nmetadata-files:\n- _author.yml\n---\n\n{{< include blocks/intro.qmd >}}\n\n::: {#refs}\n:::\n',
    );
    await ws.writeFile(
      `${DIR}/blocks/intro.qmd`,
      '# Introduction {#sec-intro .deo-intro}\n\nBody.\n',
    );
    const hook = renderHook(() => useBlocks(ws, DIR));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const block = hook.result.current.blocks[0];
    render(
      <BlockHeader
        short={block.short}
        title={block.title}
        collapsed={false}
        onToggle={() => undefined}
        wordCount={0}
        saveStatus="saved"
        onTitleSave={(title) => hook.result.current.setTitle(block.short, title)}
      />,
    );

    const input = screen.getByTestId('block-title');
    fireEvent.change(input, { target: { value: 'Background' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(async () => {
      expect(await ws.readFile(`${DIR}/blocks/intro.qmd`)).toBe(
        '# Background {#sec-intro .deo-intro}\n\nBody.\n',
      );
    });
    expect(await ws.listFiles(`${DIR}/blocks`)).toEqual(['intro.qmd']);
  });
});
