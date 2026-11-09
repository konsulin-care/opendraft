/**
 * retitleBlock tests: retitling drives the block's short name. A changed
 * slug reuses the rename path (file, include, anchor, other blocks'
 * `@sec-` refs), an unchanged slug rewrites only the heading title, and a
 * slug owned by another block gets a unique suffix. Also covers the
 * `retitle` mutation that useBlocks exposes.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { retitleBlock } from './retitle';
import { useBlocks } from './use-blocks';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

/** Lowercase Crockford base32 characters used in duplicate suffixes. */
const SUFFIX = '[0-9abcdefghjkmnpqrstuvwxyz]{6}';

/**
 * Build an assembly listing the given short names as include lines.
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
 * @param title - Heading title.
 * @param anchor - Heading anchor including the `sec-` prefix.
 * @param type - Section type without the `deo-` prefix.
 * @param body - Section body after the heading line.
 * @returns Block file text opening with a canonical heading.
 */
function blockFile(title: string, anchor: string, type: string, body = ''): string {
  return `# ${title} {#${anchor} .deo-${type}}\n${body}`;
}

/**
 * Write fixture files into a fresh in-memory workspace.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns The populated workspace.
 */
async function workspaceWith(files: Record<string, string>): Promise<WorkspaceAdapter> {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) {
    await ws.writeFile(path, content);
  }
  return ws;
}

/**
 * Read the include order back out of the assembly.
 *
 * @param ws - Workspace holding the fixture.
 * @returns Block short names in assembly include order.
 */
async function includeOrder(ws: WorkspaceAdapter): Promise<string[]> {
  const article = (await ws.readFile(ARTICLE)) ?? '';
  const shorts: string[] = [];
  for (const line of article.split('\n')) {
    const match = /\{\{< include\s+blocks\/([a-z0-9-]+)\.qmd\s*>\}\}/.exec(line.trim());
    if (match) shorts.push(match[1]);
  }
  return shorts;
}

/**
 * Workspace with a custom short name (`background`) whose title slug
 * differs, plus a block referencing it via `@sec-background`.
 *
 * @returns The populated workspace.
 */
async function renameFixture(): Promise<WorkspaceAdapter> {
  return workspaceWith({
    [ARTICLE]: articleWith('background', 'methods'),
    // Custom short name: the file stem does not match its title's slug.
    [`${BLOCKS}/background.qmd`]: blockFile('Overview', 'sec-background', 'intro', '\nBody.\n'),
    [`${BLOCKS}/methods.qmd`]: blockFile(
      'Methods',
      'sec-methods',
      'methods',
      '\nSee @sec-background for details.\n',
    ),
  });
}

/**
 * Workspace where the `intro` short name is already owned by another block.
 *
 * @returns The populated workspace.
 */
async function takenSlugFixture(): Promise<WorkspaceAdapter> {
  return workspaceWith({
    [ARTICLE]: articleWith('intro', 'methods'),
    [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    [`${BLOCKS}/methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods', '\nBody.\n'),
  });
}

describe('retitleBlock', () => {
  it("retitle.ts: retitling to a title whose slug differs renames the block file, include line, heading anchor and other blocks' @sec- references to the new short name, replacing a custom short name", async () => {
    const ws = await renameFixture();

    const next = await retitleBlock(ws, DIR, 'background', 'Introduction');

    expect(next).toBe('intro');
    expect(await ws.readFile(`${BLOCKS}/background.qmd`)).toBeNull();
    const renamed = (await ws.readFile(`${BLOCKS}/intro.qmd`)) ?? '';
    expect(renamed).toBe('# Introduction {#sec-intro .deo-intro}\n\nBody.\n');
    expect(await includeOrder(ws)).toEqual(['intro', 'methods']);
    const methods = (await ws.readFile(`${BLOCKS}/methods.qmd`)) ?? '';
    expect(methods).toContain('@sec-intro');
    expect(methods).not.toContain('@sec-background');
  });

  it("retitle.ts: retitling to a title with the same slug rewrites only the heading title and keeps file and anchor", async () => {
    const ws = await workspaceWith({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro', '\nBody.\n'),
    });

    const next = await retitleBlock(ws, DIR, 'intro', 'Intro');

    expect(next).toBe('intro');
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBe(
      '# Intro {#sec-intro .deo-intro}\n\nBody.\n',
    );
    expect(await ws.listFiles(BLOCKS)).toEqual(['intro.qmd']);
    expect(await includeOrder(ws)).toEqual(['intro']);
  });

  it('retitle.ts: when the new slug is already used by another block the new short name gets a unique suffix', async () => {
    const ws = await takenSlugFixture();

    const next = await retitleBlock(ws, DIR, 'methods', 'Introduction');

    expect(next).toMatch(new RegExp(`^intro-${SUFFIX}$`));
    expect(await ws.readFile(`${BLOCKS}/methods.qmd`)).toBeNull();
    const renamed = (await ws.readFile(`${BLOCKS}/${next}.qmd`)) ?? '';
    expect(renamed).toBe(`# Introduction {#sec-${next} .deo-methods}\n\nBody.\n`);
    expect(await includeOrder(ws)).toEqual(['intro', next]);
    // The block owning the taken slug keeps its own file, anchor and include.
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBe(
      '# Introduction {#sec-intro .deo-intro}\n',
    );
  });
});

describe('useBlocks retitle', () => {
  it('exposes retitle, which renames the block and refreshes the list', async () => {
    const ws = await workspaceWith({
      [ARTICLE]: articleWith('background', 'methods'),
      [`${BLOCKS}/background.qmd`]: blockFile('Overview', 'sec-background', 'intro', '\nBody.\n'),
      [`${BLOCKS}/methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods'),
    });
    const rendered = renderHook(() => useBlocks(ws, DIR));
    await waitFor(() => expect(rendered.result.current.loading).toBe(false));

    let next = '';
    await act(async () => {
      next = await rendered.result.current.retitle('background', 'Introduction');
    });

    expect(next).toBe('intro');
    expect(await ws.readFile(`${BLOCKS}/background.qmd`)).toBeNull();
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toContain('# Introduction {#sec-intro');
    expect(rendered.result.current.blocks.map((block) => block.short)).toEqual([
      'intro',
      'methods',
    ]);
  });
});
