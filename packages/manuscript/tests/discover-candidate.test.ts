import { describe, expect, it } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { classifyCandidate } from '../src/index';

/** Canonical article frontmatter matching the starter template. */
const ARTICLE_HEAD = `---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
bibliography: ../references.bib
---
`;

/**
 * Build a block-layout manuscript mirroring the user's tree.
 *
 * @param dir - Manuscript directory to write into.
 * @returns The workspace holding the fixture.
 */
async function blockFixture(dir: string): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  const includes = ['_introduction', '_methods', '_results', '_conclusion'];
  await ws.writeFile(
    `${dir}/article.qmd`,
    `${ARTICLE_HEAD}\n${includes.map((short) => `{{< include blocks/${short}.qmd >}}`).join('\n')}\n`,
  );
  for (const short of includes) {
    await ws.writeFile(`${dir}/blocks/${short}.qmd`, `# ${short.slice(1)}\n`);
  }
  await ws.writeFile(`${dir}/_author.yml`, 'authors: []\n');
  await ws.writeFile(`${dir}/_abstract.yml`, 'abstract: ""\n');
  await ws.writeFile(`${dir}/_frontmatter.yml`, 'title: "Article"\n');
  await ws.writeFile(`${dir}/supplementaries/_codebook.qmd`, '# Codebook\n');
  await ws.writeFile(`${dir}/supplementaries/score-AL/CBS.qmd`, '# CBS\n');
  return ws;
}

describe('classifyCandidate — valid block layout', () => {
  it('returns valid, block, no missing files and no warnings for the case-series-review fixture', async () => {
    const ws = await blockFixture('manuscripts/case-series-review');

    const candidate = await classifyCandidate(ws, 'manuscripts/case-series-review');

    expect(candidate.id).toBe('case-series-review');
    expect(candidate.path).toBe('manuscripts/case-series-review');
    expect(candidate.status).toBe('valid');
    expect(candidate.layout).toBe('block');
    expect(candidate.missingFiles).toEqual([]);
    expect(candidate.warnings).toEqual([]);
    expect(candidate.reason).toBeUndefined();
  });

  it('reports legacy layout when no prefixed block file exists', async () => {
    const ws = await blockFixture('manuscripts/legacy-paper');
    for (const short of ['_introduction', '_methods', '_results', '_conclusion']) {
      await ws.writeFile(`manuscripts/legacy-paper/blocks/${short.slice(1)}.qmd`, '# x\n');
      await ws.deleteFile(`manuscripts/legacy-paper/blocks/${short}.qmd`);
    }
    await ws.writeFile(
      'manuscripts/legacy-paper/article.qmd',
      `${ARTICLE_HEAD}\n{{< include blocks/introduction.qmd >}}\n`,
    );

    const candidate = await classifyCandidate(ws, 'manuscripts/legacy-paper');

    expect(candidate.status).toBe('valid');
    expect(candidate.layout).toBe('legacy');
  });

  it('reports legacy layout when the blocks directory is absent', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile('manuscripts/plain-paper/article.qmd', ARTICLE_HEAD);
    await ws.writeFile('manuscripts/plain-paper/_author.yml', 'authors: []\n');
    await ws.writeFile('manuscripts/plain-paper/_abstract.yml', 'abstract: ""\n');
    await ws.writeFile('manuscripts/plain-paper/_frontmatter.yml', 'title: "Article"\n');

    const candidate = await classifyCandidate(ws, 'manuscripts/plain-paper');

    expect(candidate.status).toBe('valid');
    expect(candidate.layout).toBe('legacy');
    expect(candidate.warnings).toEqual([]);
  });
});

describe('classifyCandidate — front-matter warnings', () => {
  it('warns about a bibliography path that is not ../references.bib', async () => {
    const ws = await blockFixture('manuscripts/other-bib');
    await ws.writeFile(
      'manuscripts/other-bib/article.qmd',
      `${ARTICLE_HEAD.replace('bibliography: ../references.bib', 'bibliography: refs.bib')}\n`,
    );

    const candidate = await classifyCandidate(ws, 'manuscripts/other-bib');

    expect(candidate.status).toBe('valid');
    expect(candidate.warnings).toEqual(['bibliography-mismatch']);
  });

  it('warns when metadata-files omits a metadata starter file and keeps the status valid', async () => {
    const ws = await blockFixture('manuscripts/incomplete-metadata');
    await ws.writeFile(
      'manuscripts/incomplete-metadata/article.qmd',
      `${ARTICLE_HEAD.replace('- _abstract.yml\n', '')}\n`,
    );

    const candidate = await classifyCandidate(ws, 'manuscripts/incomplete-metadata');

    expect(candidate.status).toBe('valid');
    expect(candidate.warnings).toEqual(['metadata-files-mismatch']);
  });
});

describe('classifyCandidate — repairable', () => {
  it('returns repairable with the single missing metadata file', async () => {
    const ws = await blockFixture('manuscripts/needs-author');
    await ws.deleteFile('manuscripts/needs-author/_author.yml');

    const candidate = await classifyCandidate(ws, 'manuscripts/needs-author');

    expect(candidate.status).toBe('repairable');
    expect(candidate.missingFiles).toEqual(['_author.yml']);
  });
});

describe('classifyCandidate — rejected', () => {
  it('rejects a folder without article.qmd', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile('manuscripts/no-article/_author.yml', 'authors: []\n');

    const candidate = await classifyCandidate(ws, 'manuscripts/no-article');

    expect(candidate.status).toBe('rejected');
    expect(candidate.reason).toBe('missing-article');
  });

  it('rejects an invalid folder name and suggests a normalized id', async () => {
    const ws = await blockFixture('manuscripts/Case_Series');

    const candidate = await classifyCandidate(ws, 'manuscripts/Case_Series');

    expect(candidate.status).toBe('rejected');
    expect(candidate.reason).toBe('invalid-id');
    expect(candidate.suggestedId).toBe('case-series');
  });

  it('rejects an include that targets a missing file', async () => {
    const ws = await blockFixture('manuscripts/broken-include');
    await ws.deleteFile('manuscripts/broken-include/blocks/_methods.qmd');

    const candidate = await classifyCandidate(ws, 'manuscripts/broken-include');

    expect(candidate.status).toBe('rejected');
    expect(candidate.reason).toBe('missing-include');
  });
});
