import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { useBlocks } from './use-blocks';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

/** Build an assembly listing the given short names as include lines. */
function articleWith(...shorts: string[]): string {
  const includes = shorts.map((short) => `{{< include blocks/${short}.qmd >}}`).join('\n\n');
  return `---\nmetadata-files:\n- _author.yml\n---\n\n${includes}\n\n::: {#refs}\n:::\n`;
}

/** Build canonical block file text opening with a typed heading. */
function blockFile(title: string, anchor: string, type: string, body = ''): string {
  return `# ${title} {#${anchor} .deo-${type}}\n${body}`;
}

/** Write fixture files into a fresh workspace and render the hook. */
async function setup(files: Record<string, string>) {
  const ws = new MemoryWorkspace();
  for (const [path, content] of Object.entries(files)) {
    await ws.writeFile(path, content);
  }
  const rendered = renderHook(() => useBlocks(ws, DIR));
  await waitFor(() => expect(rendered.result.current.loading).toBe(false));
  return { ws, result: rendered.result };
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
    const match = /\{\{< include\s+blocks\/_?([a-z0-9-]+)\.qmd\s*>\}\}/.exec(line.trim());
    if (match) shorts.push(match[1]);
  }
  return shorts;
}

describe('loadBlocks', () => {
  it('renames a legacy block file and rewrites its include before the list loads', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    // The legacy file was renamed and the include canonicalized by the
    // time the hook finished its initial load.
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBeNull();
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBe(
      blockFile('Introduction', 'sec-intro', 'intro'),
    );
    expect(await ws.readFile(ARTICLE)).toContain('{{< include blocks/_intro.qmd >}}');
    expect(result.current.blocks).toEqual([
      { short: 'intro', title: 'Introduction', wordCount: 0 },
    ]);
  });

  it('returns the block list in article.qmd include order', async () => {
    const { result } = await setup({
      [ARTICLE]: articleWith('methods', 'intro'),
      [`${BLOCKS}/methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    expect(result.current.blocks.map((block) => block.short)).toEqual(['methods', 'intro']);
    expect(result.current.blocks.map((block) => block.title)).toEqual(['Methods', 'Introduction']);
  });

  it('lists each block with the word count of its body, excluding the heading line', async () => {
    const { result } = await setup({
      [ARTICLE]: articleWith('intro', 'empty'),
      [`${BLOCKS}/intro.qmd`]: blockFile(
        'Introduction',
        'sec-intro',
        'intro',
        'One two three four five.\n',
      ),
      [`${BLOCKS}/empty.qmd`]: blockFile('Empty', 'sec-empty', 'empty'),
    });

    // The heading line carries three whitespace tokens of its own; only
    // body words may count, and a body-less block counts zero.
    expect(result.current.blocks.map((block) => block.wordCount)).toEqual([5, 0]);
  });
});

describe('createBlock', () => {
  it('creates a block by writing its file and inserting the include at the position', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('Alpha', 'sec-alpha', 'alpha'),
      [`${BLOCKS}/beta.qmd`]: blockFile('Beta', 'sec-beta', 'beta'),
    });

    await act(async () => {
      await result.current.createBlock(1, 'Methods');
    });

    const created = (await ws.readFile(`${BLOCKS}/_methods.qmd`)) ?? '';
    expect(created).toContain('# Methods {#sec-methods .doco-section}');
    expect(await includeOrder(ws)).toEqual(['alpha', 'methods', 'beta']);
    expect(result.current.blocks.map((block) => block.short)).toEqual(['alpha', 'methods', 'beta']);
  });

  it('gives a draft short name already used by another block a unique suffix', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    await act(async () => {
      await result.current.createBlock(1, {
        title: 'Introduction',
        short: 'intro',
        role: 'introduction',
      });
    });

    // The pre-existing block's file stays untouched; the new block gets a
    // suffixed file name and its own include line.
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBe(
      blockFile('Introduction', 'sec-intro', 'intro'),
    );
    const files = await ws.listFiles(BLOCKS);
    expect(files).toContain('_intro.qmd');
    const createdName = files.find((file) => file !== '_intro.qmd');
    expect(createdName).toMatch(/^_intro-[a-z0-9]{6}\.qmd$/);
    const createdShort = createdName?.replace(/^_/, '').replace(/\.qmd$/, '');
    const created = (await ws.readFile(`${BLOCKS}/_${createdShort}.qmd`)) ?? '';
    expect(created).toContain('.deo-introduction');
    expect(await includeOrder(ws)).toEqual(['intro', createdShort]);
    expect(result.current.blocks.map((block) => block.short)).toEqual(['intro', createdShort]);
  });
});

describe('createBlock drafts', () => {
  it('writes a .deo-methods heading with the chosen short name for a role draft', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    await act(async () => {
      await result.current.createBlock(1, { title: 'Methods', short: 'methods', role: 'methods' });
    });

    const created = (await ws.readFile(`${BLOCKS}/_methods.qmd`)) ?? '';
    expect(created).toContain('# Methods {#sec-methods .deo-methods}');
    expect(await includeOrder(ws)).toEqual(['intro', 'methods']);
    expect(result.current.blocks.map((block) => block.short)).toEqual(['intro', 'methods']);
  });

  it('writes the generic .doco-section heading for a custom draft that carries no role', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    await act(async () => {
      await result.current.createBlock(1, { title: 'Custom', short: 'custom' });
    });

    const created = (await ws.readFile(`${BLOCKS}/_custom.qmd`)) ?? '';
    expect(created.split('\n')[0]).toBe('# Custom {#sec-custom .doco-section}');
    expect(created).not.toContain('.deo-');
    expect(await includeOrder(ws)).toEqual(['intro', 'custom']);
    expect(result.current.blocks.map((block) => block.short)).toEqual(['intro', 'custom']);
  });
});

describe('deleteBlock', () => {
  it('deletes a block by removing its include line and deleting its file', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('Alpha', 'sec-alpha', 'alpha'),
      [`${BLOCKS}/beta.qmd`]: blockFile('Beta', 'sec-beta', 'beta'),
    });

    await act(async () => {
      await result.current.deleteBlock('alpha');
    });

    expect(await ws.readFile(`${BLOCKS}/_alpha.qmd`)).toBeNull();
    expect(await includeOrder(ws)).toEqual(['beta']);
    expect(result.current.blocks.map((block) => block.short)).toEqual(['beta']);
  });
});

describe('renameBlock', () => {
  it('renames the file, updates the include and rewrites @sec- refs in other blocks', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro', 'methods'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
      [`${BLOCKS}/methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods', '\nSee @sec-intro for background.\n'),
    });

    await act(async () => {
      await result.current.renameBlock('intro', 'overview');
    });

    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBeNull();
    const renamed = (await ws.readFile(`${BLOCKS}/_overview.qmd`)) ?? '';
    expect(renamed).toContain('{#sec-overview');
    expect(await includeOrder(ws)).toEqual(['overview', 'methods']);
    const methods = (await ws.readFile(`${BLOCKS}/_methods.qmd`)) ?? '';
    expect(methods).toContain('@sec-overview');
    expect(methods).not.toContain('@sec-intro');
  });

  it('re-emits a class-less heading without adding a class when renaming', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro', 'methods'),
      [`${BLOCKS}/intro.qmd`]: '# Introduction {#sec-intro}\nBody.\n',
      [`${BLOCKS}/methods.qmd`]: blockFile(
        'Methods',
        'sec-methods',
        'methods',
        '\nSee @sec-intro for background.\n',
      ),
    });

    await act(async () => {
      await result.current.renameBlock('intro', 'overview');
    });

    const renamed = (await ws.readFile(`${BLOCKS}/_overview.qmd`)) ?? '';
    expect(renamed).toBe('# Introduction {#sec-overview}\nBody.\n');
    expect(renamed).not.toContain('.deo-');
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBeNull();
    const methods = (await ws.readFile(`${BLOCKS}/_methods.qmd`)) ?? '';
    expect(methods).toContain('@sec-overview');
  });
});

describe('setTitle', () => {
  it('changes a title while the file name and anchor stay unchanged', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro', '\nBody.\n'),
    });

    await act(async () => {
      await result.current.setTitle('intro', 'Background');
    });

    const retitle = (await ws.readFile(`${BLOCKS}/_intro.qmd`)) ?? '';
    expect(retitle).toContain('# Background {#sec-intro .deo-intro}');
    expect(await ws.listFiles(BLOCKS)).toEqual(['_intro.qmd']);
    expect(await includeOrder(ws)).toEqual(['intro']);
  });

  it('rewrites only the heading title, leaving anchor, class and body untouched', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro', '\nBody.\n'),
    });

    await act(async () => {
      await result.current.setTitle('intro', 'Background');
    });

    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBe(
      '# Background {#sec-intro .deo-intro}\n\nBody.\n',
    );
    expect(await ws.listFiles(BLOCKS)).toEqual(['_intro.qmd']);
    expect(await includeOrder(ws)).toEqual(['intro']);
  });

  it('re-emits a class-less heading without adding a class', async () => {
    const { result, ws } = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: '# Introduction {#sec-intro}\nBody.\n',
    });

    await act(async () => {
      await result.current.setTitle('intro', 'Background');
    });

    const retitle = (await ws.readFile(`${BLOCKS}/_intro.qmd`)) ?? '';
    expect(retitle).toBe('# Background {#sec-intro}\nBody.\n');
    expect(retitle).not.toContain('.deo-');
    expect(await ws.listFiles(BLOCKS)).toEqual(['_intro.qmd']);
  });
});
