import { describe, expect, it } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { addBlock, listBlocks } from '../src/blocks';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

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
 * @returns Block file text opening with a canonical heading.
 */
function blockFile(title: string, anchor: string, type: string): string {
  return `# ${title} {#${anchor} .deo-${type}}\n`;
}

/**
 * Write fixture files into a fresh workspace.
 *
 * @param files - Repo-relative paths mapped to file contents.
 * @returns The workspace holding the fixture.
 */
async function setup(files: Record<string, string>) {
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
async function includeOrder(ws: MemoryWorkspace): Promise<string[]> {
  const article = (await ws.readFile(ARTICLE)) ?? '';
  const shorts: string[] = [];
  for (const line of article.split('\n')) {
    const match = /\{\{< include\s+blocks\/([a-z0-9-]+)\.qmd\s*>\}\}/.exec(line.trim());
    if (match) shorts.push(match[1]);
  }
  return shorts;
}

describe('addBlock', () => {
  it('writes the block file with a generic heading and inserts the include at the position', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha', 'beta'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('Alpha', 'sec-alpha', 'alpha'),
      [`${BLOCKS}/beta.qmd`]: blockFile('Beta', 'sec-beta', 'beta'),
    });

    await addBlock(ws, DIR, 1, 'Methods');

    const created = (await ws.readFile(`${BLOCKS}/methods.qmd`)) ?? '';
    expect(created).toBe('# Methods {#sec-methods .doco-section}\n');
    expect(await includeOrder(ws)).toEqual(['alpha', 'methods', 'beta']);
  });

  it('inserts the include before ::: {#refs} when no include exists', async () => {
    const ws = await setup({ [ARTICLE]: articleWith() });

    await addBlock(ws, DIR, 0, 'Intro');

    const article = (await ws.readFile(ARTICLE)) ?? '';
    const includeAt = article.indexOf('{{< include blocks/intro.qmd >}}');
    const refsAt = article.indexOf('::: {#refs}');
    expect(includeAt).toBeGreaterThan(-1);
    expect(includeAt).toBeLessThan(refsAt);
    expect(await includeOrder(ws)).toEqual(['intro']);
  });

});

describe('addBlock de-duplication', () => {
  it('de-duplicates a short name already used by an include', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    await addBlock(ws, DIR, 1, { title: 'Introduction', short: 'intro' });

    // The pre-existing block stays untouched; the new block gets a
    // suffixed file name and its own include line.
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBe(
      blockFile('Introduction', 'sec-intro', 'intro'),
    );
    const files = await ws.listFiles(BLOCKS);
    expect(files).toContain('intro.qmd');
    const createdName = files.find((file) => file !== 'intro.qmd');
    expect(createdName).toMatch(/^intro-\d{6}\.qmd$/);
    expect(await includeOrder(ws)).toEqual(['intro', createdName?.replace(/\.qmd$/, '')]);
  });

  it('de-duplicates a short name already used by a block file', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('alpha'),
      [`${BLOCKS}/alpha.qmd`]: blockFile('Alpha', 'sec-alpha', 'alpha'),
      [`${BLOCKS}/orphan.qmd`]: blockFile('Orphan', 'sec-orphan', 'orphan'),
    });

    await addBlock(ws, DIR, 1, { title: 'Orphan', short: 'orphan' });

    const files = await ws.listFiles(BLOCKS);
    expect(files).toContain('orphan.qmd');
    const createdName = files.find((file) => file !== 'orphan.qmd' && file !== 'alpha.qmd');
    expect(createdName).toMatch(/^orphan-\d{6}\.qmd$/);
    expect(await ws.readFile(`${BLOCKS}/orphan.qmd`)).toBe(
      blockFile('Orphan', 'sec-orphan', 'orphan'),
    );
    expect(await includeOrder(ws)).toEqual(['alpha', createdName?.replace(/\.qmd$/, '')]);
  });
});

describe('listBlocks', () => {
  it('returns blocks in article.qmd include order with titles read from their headings', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('methods', 'intro'),
      [`${BLOCKS}/methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    const blocks = await listBlocks(ws, DIR);

    expect(blocks.map((block) => block.short)).toEqual(['methods', 'intro']);
    expect(blocks.map((block) => block.title)).toEqual(['Methods', 'Introduction']);
  });

  it('falls back to the short name for a missing or heading-less block file', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('gone', 'plain'),
      [`${BLOCKS}/plain.qmd`]: 'Just prose.\n',
    });

    const blocks = await listBlocks(ws, DIR);

    expect(blocks).toEqual([
      { short: 'gone', title: 'gone', body: '' },
      { short: 'plain', title: 'plain', body: 'Just prose.\n' },
    ]);
  });
});
