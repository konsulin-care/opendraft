// @vitest-environment jsdom
/**
 * BlockEditor retitle tests: committing a new title renames the block
 * file and its reference chip while the block keeps its collapsed or
 * expanded state. Moved out of BlockEditor.test.tsx, which sits at the
 * 300-line max-lines ceiling.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from './BlockEditor';
import { blockCollapseStorageKey } from './use-collapse-state';

vi.mock('../caret-mode-switch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../caret-mode-switch')>()),
  requestFocusForShort: vi.fn(),
}));

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

/**
 * Build an assembly listing the given short names in include order.
 *
 * @param shorts - Block short names in include order.
 * @returns article.qmd text with front matter and a refs fence.
 */
function articleWith(...shorts: string[]): string {
  const includes = shorts.map((short) => `{{< include blocks/${short}.qmd >}}`).join('\n\n');
  return `---\nmetadata-files:\n- _author.yml\n---\n\n${includes}\n\n::: {#refs}\n:::\n`;
}

/**
 * Build canonical block file text.
 *
 * @param short - Block short name used for the anchor.
 * @param title - Heading title.
 * @param body - Block body after the heading line.
 * @returns Block file text opening with a canonical heading.
 */
function blockFile(short: string, title: string, body = ''): string {
  return `# ${title} {#sec-${short} .deo-section}\n${body}`;
}

/**
 * Write a fixture assembly into a fresh workspace and render the shell.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns The workspace the rendered editor reads and writes.
 */
async function setup(files: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) {
    await ws.writeFile(path, content);
  }
  render(<BlockEditor ws={ws} dir={DIR} projectKey="block-editor-test" />);
  await screen.findAllByTestId('block-title');
  return ws;
}

describe('BlockEditor rename on title commit', () => {
  it('renames the block and its reference chip when a new title is committed', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha', 'Body.\n'),
    });
    const title = screen.getByTestId('block-title');
    fireEvent.change(title, { target: { value: 'Background' } });
    fireEvent.keyDown(title, { key: 'Enter' });
    await waitFor(async () => {
      expect(await ws.readFile(`${BLOCKS}/background.qmd`)).toBe(
        '# Background {#sec-background .deo-section}\nBody.\n',
      );
    });
    expect(await ws.readFile(`${BLOCKS}/alpha.qmd`)).toBeNull();
    expect(await ws.readFile(ARTICLE)).toContain(
      '{{< include blocks/background.qmd >}}',
    );
    expect(
      await screen.findByRole('button', { name: 'Copy @sec-background reference' }),
    ).toBeInTheDocument();
  });
});

describe('BlockEditor rename keeps collapse state', () => {
  it('keeps the collapsed state when the block is renamed', async () => {
    localStorage.clear();
    localStorage.setItem(
      blockCollapseStorageKey('block-editor-test'),
      JSON.stringify({ alpha: true }),
    );
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha', 'Body.\n'),
    });
    expect(screen.getByRole('button', { name: 'Alpha section' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    const title = screen.getByTestId('block-title');
    fireEvent.change(title, { target: { value: 'Background' } });
    fireEvent.keyDown(title, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Background section' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
    expect(await ws.readFile(`${BLOCKS}/background.qmd`)).not.toBeNull();
    expect(
      JSON.parse(localStorage.getItem(blockCollapseStorageKey('block-editor-test')) ?? '{}'),
    ).toEqual({ background: true });
    localStorage.clear();
  });
});
