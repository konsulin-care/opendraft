// @vitest-environment jsdom
/**
 * BlockEditor tests: include-ordered collapsible containers, hover '+'
 * insert points opening the add form at the clicked position, the delete
 * confirmation naming the section and listing breaking `@sec-`
 * references, and confirm deleting versus cancel leaving the block.
 */
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from './BlockEditor';

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
  await screen.findAllByRole('heading', { level: 1 });
  return ws;
}

describe('BlockEditor container list', () => {
  it('renders one collapsible container per included block in include order', async () => {
    await setup({
      [ARTICLE]: articleWith('intro', 'methods', 'results'),
      [`${BLOCKS}/intro.qmd`]: blockFile('intro', 'Introduction'),
      [`${BLOCKS}/methods.qmd`]: blockFile('methods', 'Methods'),
      [`${BLOCKS}/results.qmd`]: blockFile('results', 'Results'),
    });

    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Introduction',
      'Methods',
      'Results',
    ]);
    for (const title of ['Introduction', 'Methods', 'Results']) {
      const toggle = screen.getByRole('button', { name: `${title} section` });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle.closest('section')).not.toBeNull();
    }
  });
});

describe('BlockEditor insert points', () => {
  it('opens the add form at the insert point that was clicked', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
      [`${BLOCKS}/beta.qmd`]: blockFile('beta', 'Beta'),
    });

    // One '+' between the two blocks and one after the last.
    const points = screen.getAllByRole('button', { name: 'Insert block here' });
    expect(points).toHaveLength(3);

    // The middle insert point opens the form between Alpha and Beta.
    fireEvent.click(points[1]);
    let form = screen.getByLabelText('Add block');
    const alpha = screen.getByRole('heading', { level: 1, name: 'Alpha' });
    const beta = screen.getByRole('heading', { level: 1, name: 'Beta' });
    expect(alpha.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(form.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // Escape closes it; the end insert point opens the form after Beta.
    fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Escape' });
    expect(screen.queryByLabelText('Add block')).toBeNull();
    const endPoints = screen.getAllByRole('button', { name: 'Insert block here' });
    fireEvent.click(endPoints[2]);
    form = screen.getByLabelText('Add block');
    expect(beta.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // Enter creates the block at that insert position.
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Discussion' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Enter' });
    });
    expect(screen.queryByLabelText('Add block')).toBeNull();
    const after = screen.getAllByRole('heading', { level: 1 });
    expect(after.map((heading) => heading.textContent)).toEqual(['Alpha', 'Beta', 'Discussion']);
    expect(await ws.readFile(ARTICLE)).toContain(
      '{{< include blocks/beta.qmd >}}\n\n{{< include blocks/discussion.qmd >}}',
    );
  });
});

describe('BlockEditor delete confirmation', () => {
  it("names the section and lists every '@sec-' reference that would break", async () => {
    await setup({
      [ARTICLE]: articleWith('intro', 'methods', 'results'),
      [`${BLOCKS}/intro.qmd`]: blockFile('intro', 'Introduction', 'See @sec-methods first.'),
      [`${BLOCKS}/methods.qmd`]: blockFile('methods', 'Methods', 'Body.'),
      [`${BLOCKS}/results.qmd`]: blockFile(
        'results',
        'Results',
        'Shown in @sec-methods and again @sec-methods.',
      ),
    });

    // Methods is the second block, so the second options button is its own.
    const options = screen.getAllByRole('button', { name: 'Block options' });
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
});

describe('BlockEditor delete flow', () => {
  it('deletes the block on confirm and leaves it untouched on cancel', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
      [`${BLOCKS}/beta.qmd`]: blockFile('beta', 'Beta'),
    });
    const original = await ws.readFile(ARTICLE);

    // Cancel closes the dialog and leaves the block and assembly untouched.
    fireEvent.click(screen.getAllByRole('button', { name: 'Block options' })[0]);
    const cancelDialog = await screen.findByRole('dialog', { name: 'Delete Alpha' });
    fireEvent.click(within(cancelDialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Delete Alpha' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Alpha' })).toBeInTheDocument();
    expect(await ws.readFile(ARTICLE)).toBe(original);

    // Confirm deletes the block file and its include line.
    fireEvent.click(screen.getAllByRole('button', { name: 'Block options' })[0]);
    const confirmDialog = await screen.findByRole('dialog', { name: 'Delete Alpha' });
    await act(async () => {
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete block' }));
    });
    expect(screen.queryByRole('heading', { level: 1, name: 'Alpha' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Beta' })).toBeInTheDocument();
    expect(await ws.readFile(`${BLOCKS}/alpha.qmd`)).toBeNull();
    expect(await ws.readFile(ARTICLE)).not.toContain('blocks/alpha.qmd');
    expect(await ws.readFile(ARTICLE)).toContain('blocks/beta.qmd');
  });
});
