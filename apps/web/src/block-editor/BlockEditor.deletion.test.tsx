// @vitest-environment jsdom
/**
 * BlockEditor deletion tests: the confirm/cancel delete flow, the delete
 * confirmation dialog naming the section and listing every breaking `@sec-`
 * reference, and the files-changed dispatch after a confirmed delete. Moved
 * out of BlockEditor.test.tsx, which sits at the 300-line max-lines ceiling.
 * Fixtures seed canonical prefixed `_<short>.qmd` block files.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
  const includes = shorts.map((short) => `{{< include blocks/_${short}.qmd >}}`).join('\n\n');
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

describe('BlockEditor delete confirmation', () => {
  it("names the section and lists every '@sec-' reference that would break", async () => {
    await setup({
      [ARTICLE]: articleWith('intro', 'methods', 'results'),
      [`${BLOCKS}/_intro.qmd`]: blockFile('intro', 'Introduction', 'See @sec-methods first.'),
      [`${BLOCKS}/_methods.qmd`]: blockFile('methods', 'Methods', 'Body.'),
      [`${BLOCKS}/_results.qmd`]: blockFile(
        'results',
        'Results',
        'Shown in @sec-methods and again @sec-methods.',
      ),
    });

    // Methods is the second block, so the second delete button is its own.
    const options = screen.getAllByRole('button', { name: 'Delete section' });
    fireEvent.click(options[1]);
    const dialog = await screen.findByRole('dialog', { name: 'Delete Methods' });

    expect(within(dialog).getByRole('heading', { name: 'Delete Methods' })).toBeInTheDocument();
    const items = within(dialog).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '@sec-methods in intro',
      '@sec-methods in results',
      '@sec-methods in results',
    ]);
  });

  it("lists '@sec-intro in methods' when blocks/_methods.qmd references @sec-intro", async () => {
    await setup({
      [ARTICLE]: articleWith('intro', 'methods'),
      [`${BLOCKS}/_intro.qmd`]: blockFile('intro', 'Introduction', 'See @sec-methods first.'),
      [`${BLOCKS}/_methods.qmd`]: blockFile('methods', 'Methods', 'Recap of @sec-intro.'),
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete section' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Delete Introduction' });
    const items = within(dialog).getAllByRole('listitem');
    // The source is named by its parsed short, not the `_`-prefixed file name.
    expect(items.map((item) => item.textContent)).toEqual(['@sec-intro in methods']);
  });
});

describe('BlockEditor delete confirmation skips own-file references', () => {
  it("ignores references inside the deleted block's own _intro.qmd", async () => {
    await setup({
      [ARTICLE]: articleWith('intro', 'methods'),
      [`${BLOCKS}/_intro.qmd`]: blockFile(
        'intro',
        'Introduction',
        'Restated @sec-intro and again @sec-intro.',
      ),
      [`${BLOCKS}/_methods.qmd`]: blockFile('methods', 'Methods', 'Body.'),
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete section' })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Delete Introduction' });
    expect(within(dialog).queryAllByRole('listitem')).toHaveLength(0);
    expect(
      within(dialog).getByText('No @sec- references point at this section.'),
    ).toBeInTheDocument();
  });
});

describe('BlockEditor delete flow', () => {
  it('deletes the block on confirm and leaves it untouched on cancel', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/_alpha.qmd`]: blockFile('alpha', 'Alpha'),
      [`${BLOCKS}/_beta.qmd`]: blockFile('beta', 'Beta'),
    });
    const original = await ws.readFile(ARTICLE);

    // Cancel closes the dialog and leaves the block and assembly untouched.
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete section' })[0]);
    const cancelDialog = await screen.findByRole('dialog', { name: 'Delete Alpha' });
    fireEvent.click(within(cancelDialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Delete Alpha' })).toBeNull();
    expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument();
    expect(await ws.readFile(ARTICLE)).toBe(original);

    // Confirm deletes the block file and its include line.
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete section' })[0]);
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete Alpha' });
    await act(async () => {
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete block' }));
    });
    expect(screen.queryByDisplayValue('Alpha')).toBeNull();
    expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
    expect(await ws.readFile(`${BLOCKS}/_alpha.qmd`)).toBeNull();
    expect(await ws.readFile(ARTICLE)).not.toContain('blocks/_alpha.qmd');
    expect(await ws.readFile(ARTICLE)).toContain('blocks/_beta.qmd');
  });
});

describe('BlockEditor delete files-changed event', () => {
  it('dispatches opendraft:files-changed after the block file is removed', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/_alpha.qmd`]: blockFile('alpha', 'Alpha'),
      [`${BLOCKS}/_beta.qmd`]: blockFile('beta', 'Beta'),
    });
    // The listener reads the block file at dispatch time: the event must
    // fire only once the file is already gone from the workspace.
    const order: string[] = [];
    const listener = (): void => {
      order.push('event');
      void ws.readFile(`${BLOCKS}/_alpha.qmd`).then((text) => {
        order.push(text === null ? 'file-removed' : 'file-present');
      });
    };
    window.addEventListener('opendraft:files-changed', listener);
    try {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete section' })[0]);
      const dialog = await screen.findByRole('dialog', { name: 'Delete Alpha' });
      await act(async () => {
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete block' }));
      });
      await act(async () => {});
      expect(order).toEqual(['event', 'file-removed']);
    } finally {
      window.removeEventListener('opendraft:files-changed', listener);
    }
  });
});
