import { describe, expect, it } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { addBlock, deleteBlock, listBlocks, renameBlock, setBlockTitle } from '../src/blocks';

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
 * @param body - Section body after the heading line.
 * @returns Block file text opening with a canonical heading.
 */
function blockFile(title: string, anchor: string, type: string, body = ''): string {
  return `# ${title} {#${anchor} .deo-${type}}\n${body}`;
}

/**
 * Build an assembly listing the given short names as prefixed include lines.
 *
 * @param shorts - Block short names in include order.
 * @returns article.qmd text with front matter and a refs fence.
 */
function articlePrefixed(...shorts: string[]): string {
  const includes = shorts.map((short) => `{{< include blocks/_${short}.qmd >}}`).join('\n\n');
  return `---\nmetadata-files:\n- _author.yml\n---\n\n${includes}\n\n::: {#refs}\n:::\n`;
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
    const match = /\{\{< include\s+blocks\/_?([a-z0-9-]+)\.qmd\s*>\}\}/.exec(line.trim());
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

    const created = (await ws.readFile(`${BLOCKS}/_methods.qmd`)) ?? '';
    expect(created).toBe('# Methods {#sec-methods .doco-section}\n');
    expect(await ws.readFile(ARTICLE)).toContain('{{< include blocks/_methods.qmd >}}');
    expect(await includeOrder(ws)).toEqual(['alpha', 'methods', 'beta']);
  });

  it('inserts the include before ::: {#refs} when no include exists', async () => {
    const ws = await setup({ [ARTICLE]: articleWith() });

    await addBlock(ws, DIR, 0, 'Intro');

    const article = (await ws.readFile(ARTICLE)) ?? '';
    const includeAt = article.indexOf('{{< include blocks/_intro.qmd >}}');
    const refsAt = article.indexOf('::: {#refs}');
    expect(includeAt).toBeGreaterThan(-1);
    expect(includeAt).toBeLessThan(refsAt);
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBe(
      '# Intro {#sec-intro .doco-section}\n',
    );
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
    expect(createdName).toMatch(/^_intro-\d{6}\.qmd$/);
    const createdShort = createdName?.replace(/^_/, '').replace(/\.qmd$/, '');
    expect(await includeOrder(ws)).toEqual(['intro', createdShort]);
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
    expect(createdName).toMatch(/^_orphan-\d{6}\.qmd$/);
    expect(await ws.readFile(`${BLOCKS}/orphan.qmd`)).toBe(
      blockFile('Orphan', 'sec-orphan', 'orphan'),
    );
    const createdShort = createdName?.replace(/^_/, '').replace(/\.qmd$/, '');
    expect(await includeOrder(ws)).toEqual(['alpha', createdShort]);
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
      { short: 'gone', file: '_gone.qmd', title: 'gone', body: '' },
      { short: 'plain', file: 'plain.qmd', title: 'plain', body: 'Just prose.\n' },
    ]);
  });
});

describe('listBlocks file names', () => {
  it('returns file intro.qmd for a legacy include and _intro.qmd for a prefixed include', async () => {
    const ws = await setup({
      [ARTICLE]: '---\nmetadata-files:\n- _author.yml\n---\n\n{{< include blocks/intro.qmd >}}\n\n{{< include blocks/_methods.qmd >}}\n\n::: {#refs}\n:::\n',
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
      [`${BLOCKS}/_methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods'),
    });

    const blocks = await listBlocks(ws, DIR);

    expect(blocks.map((block) => block.short)).toEqual(['intro', 'methods']);
    expect(blocks.map((block) => block.file)).toEqual(['intro.qmd', '_methods.qmd']);
  });
});

describe('renameBlock', () => {
  it('normalizes the new short, writes the prefixed file and rewrites the include and refs', async () => {
    const ws = await setup({
      [ARTICLE]: articlePrefixed('intro', 'methods'),
      [`${BLOCKS}/_intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro', 'See @sec-methods.\n'),
      [`${BLOCKS}/_methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods', 'Background in @sec-intro.\n'),
    });

    await renameBlock(ws, DIR, 'intro', 'Study Design');

    const renamed = (await ws.readFile(`${BLOCKS}/_study-design.qmd`)) ?? '';
    expect(renamed).toBe('# Introduction {#sec-study-design .deo-intro}\nSee @sec-methods.\n');
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBeNull();
    expect(await ws.readFile(ARTICLE)).toContain('{{< include blocks/_study-design.qmd >}}');
    expect(await includeOrder(ws)).toEqual(['study-design', 'methods']);
    const methods = (await ws.readFile(`${BLOCKS}/_methods.qmd`)) ?? '';
    expect(methods).toContain('Background in @sec-study-design.');
    expect(methods).not.toContain('@sec-intro');
  });

  it('rewrites a legacy blocks/intro.qmd include to the canonical include line', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    await renameBlock(ws, DIR, 'intro', 'background');

    expect(await ws.readFile(`${BLOCKS}/_background.qmd`)).toBe(
      '# Introduction {#sec-background .deo-intro}\n',
    );
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBeNull();
    expect(await ws.readFile(ARTICLE)).toContain('{{< include blocks/_background.qmd >}}');
    expect(await includeOrder(ws)).toEqual(['background']);
  });
});

describe('renameBlock name collisions', () => {
  it('throws when the target short is taken and changes nothing', async () => {
    const article = articlePrefixed('intro', 'methods');
    const intro = blockFile('Introduction', 'sec-intro', 'intro', 'Body.\n');
    const methods = blockFile('Methods', 'sec-methods', 'methods', 'Body.\n');
    const ws = await setup({
      [ARTICLE]: article,
      [`${BLOCKS}/_intro.qmd`]: intro,
      [`${BLOCKS}/_methods.qmd`]: methods,
      [`${BLOCKS}/results.qmd`]: blockFile('Results', 'sec-results', 'results'),
    });

    // 'methods' is already included; 'results' exists as a block file.
    await expect(renameBlock(ws, DIR, 'intro', 'methods')).rejects.toThrow();
    await expect(renameBlock(ws, DIR, 'intro', 'results')).rejects.toThrow();

    expect(await ws.readFile(ARTICLE)).toBe(article);
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBe(intro);
    expect(await ws.readFile(`${BLOCKS}/_methods.qmd`)).toBe(methods);
    expect(await ws.listFiles(BLOCKS)).toEqual(['_intro.qmd', '_methods.qmd', 'results.qmd']);
  });
});

describe('legacy block files', () => {
  it('setBlockTitle rewrites the legacy blocks/intro.qmd included as blocks/intro.qmd', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    await setBlockTitle(ws, DIR, 'intro', 'Background');

    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBe(
      '# Background {#sec-intro .deo-intro}\n',
    );
    expect(await ws.listFiles(BLOCKS)).toEqual(['intro.qmd']);
  });

  it('deleteBlock removes the legacy include line and deletes blocks/intro.qmd', async () => {
    const ws = await setup({
      [ARTICLE]: articleWith('intro', 'methods'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
      [`${BLOCKS}/methods.qmd`]: blockFile('Methods', 'sec-methods', 'methods'),
    });

    await deleteBlock(ws, DIR, 'intro');

    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBeNull();
    expect(await includeOrder(ws)).toEqual(['methods']);
  });

  it('deleteBlock removes a prefixed include line and deletes the prefixed file', async () => {
    const ws = await setup({
      [ARTICLE]: '---\nmetadata-files:\n- _author.yml\n---\n\n{{< include blocks/_intro.qmd >}}\n\n::: {#refs}\n:::\n',
      [`${BLOCKS}/_intro.qmd`]: blockFile('Introduction', 'sec-intro', 'intro'),
    });

    await deleteBlock(ws, DIR, 'intro');

    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBeNull();
    expect(await includeOrder(ws)).toEqual([]);
  });
});
