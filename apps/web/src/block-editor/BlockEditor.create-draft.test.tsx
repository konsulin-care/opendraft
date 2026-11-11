// @vitest-environment jsdom
/**
 * BlockEditor draft-creation tests: preset chips handing the full draft
 * (title, short, role) through `createAt`, custom sections without a role
 * falling back to the generic `.doco-section` class, and a taken draft
 * short name getting a unique suffix instead of overwriting the existing
 * block's file. Split out of BlockEditor.test.tsx, which sits at the
 * 300-line max-lines ceiling.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
 * @returns Block file text opening with a canonical heading.
 */
function blockFile(short: string, title: string): string {
  return `# ${title} {#sec-${short} .deo-section}\n`;
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

/**
 * Read the first line of a block file, or an empty string when absent.
 *
 * @param ws - Workspace holding the manuscript.
 * @param short - Block short name to read.
 * @returns The block file's heading line.
 */
async function headingLine(ws: WorkspaceAdapter, short: string): Promise<string> {
  const text = (await ws.readFile(`${BLOCKS}/${short}.qmd`)) ?? '';
  return text.split('\n')[0];
}

describe('BlockEditor preset drafts', () => {
  it("writes the Introduction preset's full draft to blocks/introduction.qmd", async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
    });

    fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Introduction' }));
    });

    expect(await headingLine(ws, 'introduction')).toBe(
      '# Introduction {#sec-introduction .deo-introduction}',
    );
    expect(await ws.readFile(ARTICLE)).toContain('{{< include blocks/introduction.qmd >}}');
    expect(screen.queryByRole('dialog', { name: 'Add section' })).toBeNull();
  });
});

describe('BlockEditor custom draft without a role', () => {
  it("writes a '.doco-section' heading under the draft short name", async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
    });

    fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom section' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Follow-up' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });

    const created = (await ws.readFile(`${BLOCKS}/follow-up.qmd`)) ?? '';
    expect(created.split('\n')[0]).toBe('# Follow-up {#sec-follow-up .doco-section}');
    expect(created).not.toContain('.deo-');
    expect(await ws.readFile(ARTICLE)).toContain('{{< include blocks/follow-up.qmd >}}');
  });
});

describe('BlockEditor taken draft short name', () => {
  it("gets a unique suffix instead of overwriting the existing block's file", async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('introduction'),
      [`${BLOCKS}/introduction.qmd`]: blockFile('introduction', 'Introduction'),
    });

    fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Introduction' }));
    });

    // The pre-existing block keeps its file; the new block lands beside it.
    expect(await ws.readFile(`${BLOCKS}/introduction.qmd`)).toBe(
      blockFile('introduction', 'Introduction'),
    );
    const files = await ws.listFiles(BLOCKS);
    const createdName = files.find((file) => file !== 'introduction.qmd');
    expect(createdName).toMatch(/^introduction-[a-z0-9]{6}\.qmd$/);
    const article = (await ws.readFile(ARTICLE)) ?? '';
    expect(article).toContain('{{< include blocks/introduction.qmd >}}');
    expect(article).toContain(`{{< include blocks/${createdName} >}}`);
    const created = (await ws.readFile(`${BLOCKS}/${createdName}`)) ?? '';
    expect(created).toContain('.deo-introduction');
    expect(created).toContain(`{#sec-${createdName?.replace(/\.qmd$/, '')}`);
  });
});
