import { describe, expect, it } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { normalizeBlockFiles } from '../src/normalize';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Path of the assembly under test. */
const ARTICLE = `${DIR}/article.qmd`;

/** Path of the block directory under test. */
const BLOCKS = `${DIR}/blocks`;

/**
 * Build an assembly with one legacy include for the given short.
 *
 * @param short - Block short name included in legacy form.
 * @returns article.qmd text with a legacy include and a refs fence.
 */
function legacyArticle(short: string): string {
  return `---\nmetadata-files:\n- _author.yml\n---\n\n{{< include blocks/${short}.qmd >}}\n\nSee @sec-${short}.\n\n::: {#refs}\n:::\n`;
}

/**
 * Build block file text with a canonical anchored heading.
 *
 * @param title - Heading title.
 * @param anchor - Heading anchor including the `sec-` prefix.
 * @returns Block file text opening with a canonical heading.
 */
function blockFile(title: string, anchor: string): string {
  return `# ${title} {#${anchor} .deo-intro}\nSee @sec-${anchor.slice(4)} and @sec-other.\n`;
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

describe('normalizeBlockFiles renames legacy blocks', () => {
  it('renames blocks/intro.qmd to blocks/_intro.qmd and rewrites its include, leaving anchors and refs unchanged', async () => {
    const content = blockFile('Introduction', 'sec-intro');
    const article = legacyArticle('intro');
    const ws = await setup({
      [ARTICLE]: article,
      [`${BLOCKS}/intro.qmd`]: content,
    });

    const result = await normalizeBlockFiles(ws, DIR);

    expect(result.renamed).toEqual([
      { from: `${BLOCKS}/intro.qmd`, to: `${BLOCKS}/_intro.qmd` },
    ]);
    expect(result.conflicts).toEqual([]);
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBe(content);
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBeNull();
    const updated = (await ws.readFile(ARTICLE)) ?? '';
    expect(updated).toContain('{{< include blocks/_intro.qmd >}}');
    expect(updated).not.toContain('blocks/intro.qmd');
    // The sec-intro anchor and @sec-intro refs are unchanged.
    expect(updated).toContain('See @sec-intro.');
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toContain('{#sec-intro');
  });
});

describe('normalizeBlockFiles idempotence', () => {
  it('returns no renames and no conflicts on a second run', async () => {
    const ws = await setup({
      [ARTICLE]: legacyArticle('intro'),
      [`${BLOCKS}/intro.qmd`]: blockFile('Introduction', 'sec-intro'),
    });

    await normalizeBlockFiles(ws, DIR);
    const second = await normalizeBlockFiles(ws, DIR);

    expect(second.renamed).toEqual([]);
    expect(second.conflicts).toEqual([]);
    expect(await ws.listFiles(BLOCKS)).toEqual(['_intro.qmd']);
    expect((await ws.readFile(ARTICLE)) ?? '').toContain(
      '{{< include blocks/_intro.qmd >}}',
    );
  });
});

describe('normalizeBlockFiles conflicts', () => {
  it('leaves both files and reports intro as a conflict when both forms exist', async () => {
    const legacy = blockFile('Introduction', 'sec-intro');
    const prefixed = blockFile('Introduction', 'sec-intro');
    const article = legacyArticle('intro');
    const ws = await setup({
      [ARTICLE]: article,
      [`${BLOCKS}/intro.qmd`]: legacy,
      [`${BLOCKS}/_intro.qmd`]: prefixed,
    });

    const result = await normalizeBlockFiles(ws, DIR);

    expect(result.renamed).toEqual([]);
    expect(result.conflicts).toEqual(['intro']);
    expect(await ws.readFile(`${BLOCKS}/intro.qmd`)).toBe(legacy);
    expect(await ws.readFile(`${BLOCKS}/_intro.qmd`)).toBe(prefixed);
    // Nothing changes for a conflicted short, include line included.
    expect(await ws.readFile(ARTICLE)).toBe(article);
  });
});
