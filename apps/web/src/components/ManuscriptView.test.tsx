// @vitest-environment jsdom
/**
 * ManuscriptView tests: the metadata panel above the block list inside
 * the single scroll container, the empty-state preset picker for an
 * assembly with no blocks, and the always-visible '+ Add section'
 * button that needs no hover to show.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { ManuscriptView } from './ManuscriptView';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/x';

/** Project key scoping the persisted panel state. */
const PROJECT = 'proj-view';

/** Assembly with no includes — the empty manuscript fixture. */
const EMPTY_ARTICLE = '---\nmetadata-files:\n- _author.yml\n---\n\n::: {#refs}\n:::\n';

/** DEO preset chips the empty-state picker must render. */
const PRESETS = ['Introduction', 'Methods', 'Results', 'Discussion', 'Conclusion'];

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
 * Render the view over a freshly seeded workspace.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns The workspace the rendered view reads.
 */
async function renderView(files: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) await ws.writeFile(path, content);
  render(<ManuscriptView workspace={ws} dir={DIR} projectKey={PROJECT} />);
  return ws;
}

describe('ManuscriptView metadata panel placement', () => {
  it('renders the MetadataPanel above the block list in one scroll container', async () => {
    await renderView({
      [`${DIR}/article.qmd`]: articleWith('intro', 'methods'),
      [`${DIR}/blocks/intro.qmd`]: blockFile('intro', 'Introduction'),
      [`${DIR}/blocks/methods.qmd`]: blockFile('methods', 'Methods'),
    });
    const panel = await screen.findByTestId('metadata-panel');
    const headings = await screen.findAllByTestId('block-title');
    // The panel section precedes every block heading in document order.
    const follows = panel.compareDocumentPosition(headings[0]) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(follows).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // The panel lives in the surface's single scroll container.
    const surface = screen.getByTestId('manuscript-view');
    expect(surface.children).toHaveLength(1);
    expect(panel.parentElement).toBe(surface.children[0]);
  });
});

describe('ManuscriptView empty state', () => {
  it('shows the empty-state preset picker when article.qmd has no blocks', async () => {
    await renderView({ [`${DIR}/article.qmd`]: EMPTY_ARTICLE });
    for (const name of PRESETS) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: '+ Add section' })).toBeNull();
  });
});

describe('ManuscriptView add section button', () => {
  it("shows an always-visible '+ Add section' without hover classes", async () => {
    await renderView({
      [`${DIR}/article.qmd`]: articleWith('intro'),
      [`${DIR}/blocks/intro.qmd`]: blockFile('intro', 'Introduction'),
    });
    const add = await screen.findByRole('button', { name: '+ Add section' });
    expect(add.className).not.toContain('opacity-0');
    expect(add.className).not.toContain('hidden');
    // Hover insert points remain before each block, none trailing the list.
    expect(screen.getAllByRole('button', { name: 'Insert block here' })).toHaveLength(1);
  });
});
