import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateAssembly, validateManuscript, validateMetadata, validateOpendraft } from '@opendraft/schema';
import protocolManifest from '../../../../protocol/protocol.manifest.json' with { type: 'json' };
import { OPENDRAFT_CONFIG_PATH, scaffoldProject } from './scaffold';

const MANUSCRIPT_DIR = 'manuscripts/my-paper';

/** Today's date as YYYY-MM-DD in local time. */
function todayIsoDate(): string {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mm}-${dd}`;
}

/** List the file names inside the scaffolded manuscript directory. */
async function manuscriptFiles(ws: MemoryWorkspace): Promise<string[]> {
  return ws.listFiles(MANUSCRIPT_DIR);
}

/** Extract the starter block path from a scaffolded container article. */
function starterBlockPath(article: string): string {
  return /\{\{< include (blocks\/[a-z0-9-]+\.qmd) >\}\}/.exec(article)?.[1] as string;
}

describe('scaffoldProject — opendraft.yml', () => {
  it('writes a spec-conformant opendraft.yml', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const raw = await ws.readFile(OPENDRAFT_CONFIG_PATH);
    expect(raw).not.toBeNull();

    const config = parse(raw as string);
    const result = validateOpendraft(config);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('copies the protocol version from the protocol manifest', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const config = parse((await ws.readFile(OPENDRAFT_CONFIG_PATH)) as string);
    expect(config.protocol.version).toBe(protocolManifest.protocol.version);
    expect(config.protocol).toEqual(protocolManifest.protocol);
  });

  it('declares exactly one manuscript at manuscripts/<id>', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const config = parse((await ws.readFile(OPENDRAFT_CONFIG_PATH)) as string);
    expect(config.manuscripts).toEqual([{ id: 'my-paper', path: 'manuscripts/my-paper' }]);
  });
});

describe('scaffoldProject — container article.qmd', () => {
  it('writes the container article with the include and refs fence', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const article = (await ws.readFile(`${MANUSCRIPT_DIR}/article.qmd`)) as string;
    expect(/\{\{< include (blocks\/[a-z0-9-]+\.qmd) >\}\}/.test(article)).toBe(true);

    const blockPath = starterBlockPath(article);
    expect(blockPath).toMatch(/^blocks\/[a-z0-9-]+\.qmd$/);
    expect(article).toBe(`---
metadata-files:
- _author.yml
- _abstract.yml
- _frontmatter.yml
---

{{< include ${blockPath} >}}

::: {#refs}
:::
`);
  });

  it('writes an empty starter block file', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const article = (await ws.readFile(`${MANUSCRIPT_DIR}/article.qmd`)) as string;
    const block = await ws.readFile(`${MANUSCRIPT_DIR}/${starterBlockPath(article)}`);
    expect(block).toBe('');
  });

  it('scaffolds an assembly that passes validateAssembly', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const article = (await ws.readFile(`${MANUSCRIPT_DIR}/article.qmd`)) as string;
    const blockPath = starterBlockPath(article);
    const slug = blockPath.replace(/^blocks\//, '').replace(/\.qmd$/, '');

    const result = validateAssembly({
      assembly: article,
      blockFiles: { [blockPath]: '' },
      files: [`${slug}.qmd`],
    });
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('templates/manuscript/article.qmd', () => {
  it('mirrors the scaffolded container text', async () => {
    const template = readFileSync(
      resolve(__dirname, '../../../../templates/manuscript/article.qmd'),
      'utf8',
    );
    const templateBlock = /\{\{< include (blocks\/[a-z0-9-]+\.qmd) >\}\}/.exec(template)?.[1] as string;
    expect(templateBlock).toMatch(/^blocks\/[a-z0-9-]+\.qmd$/);

    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });
    const article = (await ws.readFile(`${MANUSCRIPT_DIR}/article.qmd`)) as string;
    const scaffoldBlock = starterBlockPath(article);

    expect(template.replace(templateBlock, scaffoldBlock)).toBe(article);
  });
});

describe('scaffoldProject — _author.yml', () => {
  it('writes a starter _author.yml that validates', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const raw = (await ws.readFile(`${MANUSCRIPT_DIR}/_author.yml`)) as string;
    const data = parse(raw);
    const result = validateMetadata(data, 'author');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('starts with no authors and no affiliation registry entries', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const data = parse((await ws.readFile(`${MANUSCRIPT_DIR}/_author.yml`)) as string);
    expect(data.authors).toEqual([]);
    expect(data.affiliations).toEqual([]);
  });
});

describe('scaffoldProject — _abstract.yml', () => {
  it('writes an empty abstract that validates', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const raw = (await ws.readFile(`${MANUSCRIPT_DIR}/_abstract.yml`)) as string;
    const data = parse(raw);
    expect(data).toEqual({ abstract: '' });

    const result = validateMetadata(data, 'abstract');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('scaffoldProject — _frontmatter.yml', () => {
  it("writes today's date and the CC BY 4.0 license", async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const raw = (await ws.readFile(`${MANUSCRIPT_DIR}/_frontmatter.yml`)) as string;
    const data = parse(raw);
    expect(data.date).toBe(todayIsoDate());
    expect(data.license).toBe('CC BY 4.0');

    const result = validateMetadata(data, 'frontmatter');
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('templates/manuscript — yml files mirror the scaffold', () => {
  it('_abstract.yml mirrors the scaffolded abstract', async () => {
    const template = readFileSync(
      resolve(__dirname, '../../../../templates/manuscript/_abstract.yml'),
      'utf8',
    );
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });
    const abstract = (await ws.readFile(`${MANUSCRIPT_DIR}/_abstract.yml`)) as string;
    expect(template).toBe(abstract);
  });

  it('_author.yml mirrors the scaffolded author file', async () => {
    const template = readFileSync(
      resolve(__dirname, '../../../../templates/manuscript/_author.yml'),
      'utf8',
    );
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });
    const author = (await ws.readFile(`${MANUSCRIPT_DIR}/_author.yml`)) as string;
    expect(template).toBe(author);
  });

  it('_frontmatter.yml mirrors the scaffolded frontmatter except for the date', async () => {
    const template = readFileSync(
      resolve(__dirname, '../../../../templates/manuscript/_frontmatter.yml'),
      'utf8',
    );
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });
    const frontmatter = parse((await ws.readFile(`${MANUSCRIPT_DIR}/_frontmatter.yml`)) as string);
    // The static template cannot embed today's date; it keeps a placeholder.
    expect(parse(template)).toEqual({ ...frontmatter, date: '2024-01-15' });
  });
});

describe('scaffoldProject — manuscript layout', () => {
  it('writes a valid legacy manuscript layout', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const files = await manuscriptFiles(ws);
    expect(files.sort()).toEqual([
      '_abstract.yml',
      '_author.yml',
      '_frontmatter.yml',
      'article.qmd',
      'references.bib',
    ]);
    expect(validateManuscript('my-paper', files).valid).toBe(true);
  });

  it('scaffolds each project independently', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'first' });
    await scaffoldProject(ws, { manuscriptId: 'second' });

    const config = parse((await ws.readFile(OPENDRAFT_CONFIG_PATH)) as string);
    expect(config.manuscripts).toEqual([{ id: 'second', path: 'manuscripts/second' }]);
    expect(await ws.readFile('manuscripts/first/article.qmd')).not.toBeNull();
    expect(await ws.readFile('manuscripts/second/article.qmd')).not.toBeNull();
  });
});
