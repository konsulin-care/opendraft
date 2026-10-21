import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateAssembly, validateManuscript, validateMetadata, validateOpendraft } from '@opendraft/schema';
import protocolManifest from '../../../../protocol/protocol.manifest.json' with { type: 'json' };
import { OPENDRAFT_CONFIG_PATH, scaffoldProject } from './scaffold';

const MANUSCRIPT_DIR = 'manuscripts/my-paper';

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

  it('declares a top-level affiliation registry entry referenced by the author', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper' });

    const data = parse((await ws.readFile(`${MANUSCRIPT_DIR}/_author.yml`)) as string);
    expect(data.affiliations).toHaveLength(1);
    expect(data.affiliations[0].id).toBe('uni-example');
    expect(data.authors[0].affiliations).toEqual([{ ref: 'uni-example' }]);
    expect(data.authors[0].id).toBe('jd');
    expect(data.authors[0].name).toEqual({ given: 'Jane', family: 'Doe' });
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
