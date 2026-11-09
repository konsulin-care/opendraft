// @vitest-environment jsdom
/**
 * BlockEditor tests: include-ordered collapsible containers, hover '+'
 * insert points opening the add section dialog at the clicked position, and creation
 * emitting `opendraft:files-changed` and focusing the new block. The delete
 * confirmation and delete flow live in BlockEditor.deletion.test.tsx.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from './BlockEditor';
import { blockCollapseStorageKey } from './use-collapse-state';
import { requestFocusForShort } from '../caret-mode-switch';

vi.mock('../caret-mode-switch', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../caret-mode-switch')>()),
  requestFocusForShort: vi.fn(),
}));

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Assembly with no includes — the empty manuscript fixture. */
const EMPTY_ARTICLE = '---\nmetadata-files:\n- _author.yml\n---\n\n::: {#refs}\n:::\n';

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

/**
 * Write an empty assembly into a fresh workspace and render the shell.
 * Waits for the empty-state picker instead of block headings.
 *
 * @returns The workspace the rendered editor reads and writes.
 */
async function setupEmpty(): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(ARTICLE, EMPTY_ARTICLE);
  render(<BlockEditor ws={ws} dir={DIR} projectKey="block-editor-test" />);
  await screen.findByRole('button', { name: 'Introduction' });
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
  it('opens the add section dialog at the insert point that was clicked', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
      [`${BLOCKS}/beta.qmd`]: blockFile('beta', 'Beta'),
    });

    // One hover '+' before each block; the trailing hover point is
    // replaced by the always-visible '+ Add section' button.
    const points = screen.getAllByRole('button', { name: 'Insert block here' });
    expect(points).toHaveLength(2);

    // The middle insert point opens the dialog between Alpha and Beta.
    fireEvent.click(points[1]);
    const dialog = screen.getByRole('dialog', { name: 'Add section' });
    const alpha = screen.getByRole('heading', { level: 1, name: 'Alpha' });
    const beta = screen.getByRole('heading', { level: 1, name: 'Beta' });
    expect(alpha.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(dialog.compareDocumentPosition(beta) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    // Escape closes it; the custom view creates at the clicked position.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Add section' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Insert block here' })[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Custom section' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Discussion' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Add section' })).toBeNull();
    const after = screen.getAllByRole('heading', { level: 1 });
    expect(after.map((heading) => heading.textContent)).toEqual(['Alpha', 'Discussion', 'Beta']);
    expect(await ws.readFile(ARTICLE)).toContain(
      '{{< include blocks/alpha.qmd >}}\n\n{{< include blocks/discussion.qmd >}}',
    );
  });
});

describe('BlockEditor empty state', () => {
  it('renders the preset picker instead of the block list when no blocks exist', async () => {
    await setupEmpty();
    for (const name of ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: '+ Add section' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Insert block here' })).toBeNull();
  });
});

describe('BlockEditor add section button', () => {
  it("renders an always-visible '+ Add section' with no hover-only classes", async () => {
    await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
    });
    const add = screen.getByRole('button', { name: '+ Add section' });
    expect(add.className).not.toContain('opacity-0');
    expect(add.className).not.toContain('hidden');
    // The between-block insert point stays hover-only.
    const points = screen.getAllByRole('button', { name: 'Insert block here' });
    expect(points).toHaveLength(1);
    expect(points[0].className).toContain('opacity-0');
    fireEvent.click(add);
    expect(screen.getByRole('dialog', { name: 'Add section' })).toBeInTheDocument();
  });
});

describe('BlockEditor files-changed event', () => {
  it('dispatches files-changed on the window when a block is created', async () => {
    const seen: Event[] = [];
    const listener = (event: Event): void => { seen.push(event); };
    await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
    });
    window.addEventListener('opendraft:files-changed', listener);
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Insert block here' }));
      fireEvent.click(screen.getByRole('button', { name: 'Custom section' }));
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Discussion' } });
      await act(async () => {
        fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Enter' });
      });
      expect(seen).toHaveLength(1);
      expect(seen[0]).toBeInstanceOf(CustomEvent);
      expect(requestFocusForShort).toHaveBeenCalledWith('discussion');
      expect(screen.getByRole('heading', { level: 1, name: 'Discussion' })).toBeInTheDocument();
    } finally {
      window.removeEventListener('opendraft:files-changed', listener);
    }
  });
});

describe('BlockEditor new block expansion', () => {
  it('starts the newly created block expanded rather than collapsed', async () => {
    // Persisted collapse state marks only the pre-existing block collapsed,
    // proving the collapse machinery is active for this render.
    localStorage.clear();
    localStorage.setItem(
      blockCollapseStorageKey('block-editor-test'),
      JSON.stringify({ intro: true }),
    );
    await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('intro', 'Introduction'),
    });
    expect(screen.getByRole('button', { name: 'Introduction section' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Insert block here' }));
    fireEvent.click(screen.getByRole('button', { name: 'Custom section' }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Discussion' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Title'), { key: 'Enter' });
    });
    expect(screen.getByRole('button', { name: 'Discussion section' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    localStorage.clear();
  });
});

describe('BlockEditor add section dialog', () => {
  it('opens the dialog from + Add section and creates through createAt', async () => {
    const seen: Event[] = [];
    const listener = (event: Event): void => { seen.push(event); };
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('alpha', 'Alpha'),
    });
    window.addEventListener('opendraft:files-changed', listener);
    try {
      fireEvent.click(screen.getByRole('button', { name: '+ Add section' }));
      expect(screen.getByRole('dialog', { name: 'Add section' })).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Methods' }));
      });
      expect(screen.queryByRole('dialog', { name: 'Add section' })).toBeNull();
      expect(seen).toHaveLength(1);
      expect(seen[0]).toBeInstanceOf(CustomEvent);
      expect(requestFocusForShort).toHaveBeenCalledWith('methods');
      expect(await ws.readFile(ARTICLE)).toContain('blocks/methods.qmd');
      expect(screen.getByRole('heading', { level: 1, name: 'Methods' })).toBeInTheDocument();
    } finally {
      window.removeEventListener('opendraft:files-changed', listener);
    }
  });
});
