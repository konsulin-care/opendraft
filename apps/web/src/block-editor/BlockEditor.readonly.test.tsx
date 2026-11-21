// @vitest-environment jsdom
/**
 * Read-only tests: inside a ReadOnlyContext provider the block editor and
 * its headers drop every mutating control — insert points, the add-section
 * button, the empty-state create action, title rename and the delete
 * button — while still rendering the block titles.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { BlockEditor } from './BlockEditor';
import { BlockHeader } from './BlockHeader';
import { ReadOnlyContext } from './read-only-context';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Assembly with no includes — the empty manuscript fixture. */
const EMPTY_ARTICLE = '---\nmetadata-files:\n- _author.yml\n---\n\n::: {#refs}\n:::\n';

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
 * Render the editor inside a read-only provider over a fixture workspace.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns A promise resolved once the block headers have rendered.
 */
async function setupReadOnly(files: Record<string, string>): Promise<void> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) {
    await ws.writeFile(path, content);
  }
  render(
    <ReadOnlyContext.Provider value={true}>
      <BlockEditor ws={ws} dir={DIR} projectKey="block-editor-readonly-test" />
    </ReadOnlyContext.Provider>,
  );
}

describe('BlockEditor read-only', () => {
  it('renders no add-block or add-section control but keeps the block titles', async () => {
    await setupReadOnly({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${DIR}/blocks/alpha.qmd`]: blockFile('alpha', 'Alpha'),
      [`${DIR}/blocks/beta.qmd`]: blockFile('beta', 'Beta'),
    });
    await screen.findByText('Alpha');

    expect(screen.queryAllByRole('button', { name: 'Insert block here' })).toHaveLength(0);
    expect(screen.queryByRole('button', { name: '+ Add section' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Add section' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom section' })).toBeNull();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders no empty-state create action when no blocks exist', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(ARTICLE, EMPTY_ARTICLE);
    const { container } = render(
      <ReadOnlyContext.Provider value={true}>
        <BlockEditor ws={ws} dir={DIR} projectKey="block-editor-readonly-test" />
      </ReadOnlyContext.Provider>,
    );
    await ws.readFile(ARTICLE);

    expect(container.querySelector('button')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Introduction' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Custom section' })).toBeNull();
  });
});

describe('BlockHeader read-only', () => {
  it('shows the title but no rename, delete or drag controls', () => {
    const { container } = render(
      <ReadOnlyContext.Provider value={true}>
        <BlockHeader
          short="methods"
          title="Methods"
          collapsed={false}
          onToggle={vi.fn()}
          wordCount={42}
          saveStatus="saved"
          onOverflow={vi.fn()}
          onTitleSave={vi.fn()}
        />
      </ReadOnlyContext.Provider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Methods' })).toBeInTheDocument();
    expect(screen.queryByTestId('block-title')).toBeNull();
    expect(screen.queryByLabelText('Section title')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete section' })).toBeNull();
    expect(screen.queryByRole('button', { name: /drag/i })).toBeNull();
    expect(container.querySelector('[draggable="true"]')).toBeNull();
  });
});
