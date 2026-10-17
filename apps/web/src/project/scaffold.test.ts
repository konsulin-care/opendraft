import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateManuscript, validateOpendraft } from '@opendraft/schema';
import protocolManifest from '../../../../protocol/protocol.manifest.json' with { type: 'json' };
import { OPENDRAFT_CONFIG_PATH, scaffoldProject } from './scaffold';

const MANUSCRIPT_DIR = 'manuscripts/my-paper';

/** List the file names inside the scaffolded manuscript directory. */
async function manuscriptFiles(ws: MemoryWorkspace): Promise<string[]> {
  return ws.listFiles(MANUSCRIPT_DIR);
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
