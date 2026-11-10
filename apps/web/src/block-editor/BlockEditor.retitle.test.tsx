// @vitest-environment jsdom
/**
 * BlockEditor retitle tests (ADR-023): committing a new title rewrites
 * only the heading title. The block file name, include line and `sec-`
 * anchor stay unchanged, and `@sec-` refs in other blocks are untouched.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from './BlockEditor';

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
 * @returns article.qmd text.
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
 * @returns Block file text.
 */
function blockFile(short: string, title: string, body = ''): string {
  return `# ${title} {#sec-${short} .deo-section}\n${body}`;
}

/**
 * Write fixtures into a fresh workspace and render the shell.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns The workspace.
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

/**
 * Commit a new title in the title field at `index`.
 *
 * @param index - Row index.
 * @param value - New title.
 */
function commitTitle(index: number, value: string): void {
  const title = screen.getAllByTestId('block-title')[index];
  fireEvent.change(title, { target: { value } });
  fireEvent.keyDown(title, { key: 'Enter' });
}

/**
 * Wait until a block file holds exactly the expected text.
 *
 * @param ws - Workspace under test.
 * @param short - Block short name.
 * @param text - Expected file text.
 */
async function expectBlock(ws: WorkspaceAdapter, short: string, text: string): Promise<void> {
  await waitFor(async () => {
    expect(await ws.readFile(`${BLOCKS}/${short}.qmd`)).toBe(text);
  });
}

describe('BlockEditor title commit keeps section identity', () => {
  it('rewrites only the heading title; file, include and anchor stay', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha', 'Body.\n'),
    });
    commitTitle(0, 'Background');
    await expectBlock(ws, 'alpha', '# Background {#sec-alpha .deo-section}\nBody.\n');
    expect(await ws.readFile(`${BLOCKS}/background.qmd`)).toBeNull();
    expect(await ws.listFiles(BLOCKS)).toEqual(['alpha.qmd']);
    expect(await ws.readFile(ARTICLE)).toBe(articleWith('alpha'));
  });
});

describe('BlockEditor title round-trip keeps section identity', () => {
  it('retitling Introduction away and back keeps introduction.qmd intact', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('introduction'),
      [`${BLOCKS}/introduction.qmd`]: blockFile('introduction', 'Introduction', 'Intro body.\n'),
    });
    commitTitle(0, 'Overview');
    await expectBlock(ws, 'introduction', '# Overview {#sec-introduction .deo-section}\nIntro body.\n');
    await waitFor(() => {
      expect(screen.getAllByTestId('block-title')[0]).toHaveValue('Overview');
    });
    commitTitle(0, 'Introduction');
    await expectBlock(ws, 'introduction', blockFile('introduction', 'Introduction', 'Intro body.\n'));
    expect(await ws.listFiles(BLOCKS)).toEqual(['introduction.qmd']);
    expect(await ws.readFile(ARTICLE)).toBe(articleWith('introduction'));
  });
});

describe('BlockEditor title commit leaves references alone', () => {
  it('never rewrites @sec- references in other block files', async () => {
    const beta = blockFile('beta', 'Beta', 'See @sec-alpha for details.\n');
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha', 'Body.\n'),
      [`${BLOCKS}/beta.qmd`]: beta,
    });
    commitTitle(0, 'Background');
    await expectBlock(ws, 'alpha', '# Background {#sec-alpha .deo-section}\nBody.\n');
    expect(await ws.readFile(`${BLOCKS}/beta.qmd`)).toBe(beta);
  });
});
