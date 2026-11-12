import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateOpendraft } from '@opendraft/schema';
import { OPENDRAFT_CONFIG_PATH, addManuscript, scaffoldProject } from '../src/index';

/** Protocol block the scaffold writes into opendraft.yml. */
const PROTOCOL = {
  name: 'opendraft',
  version: 'f192c95d750b6a71b49134819b08aec509790c84',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'f192c95d750b6a71b49134819b08aec509790c84',
};

/** Starter files every scaffolded manuscript directory carries. */
const STARTER_FILES = ['article.qmd', '_author.yml', '_abstract.yml', '_frontmatter.yml'];

describe('addManuscript — starter files and registration', () => {
  it('creates manuscripts/<id>/ starter files and appends {id, path} keeping existing entries and the protocol block', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'first-paper', protocol: PROTOCOL });

    await addManuscript(ws, 'second-paper');

    for (const file of STARTER_FILES) {
      expect(await ws.readFile(`manuscripts/second-paper/${file}`)).not.toBeNull();
    }

    const raw = await ws.readFile(OPENDRAFT_CONFIG_PATH);
    expect(raw).not.toBeNull();
    const config = parse(raw as string);
    expect(config.protocol).toEqual(PROTOCOL);
    expect(config.manuscripts).toEqual([
      { id: 'first-paper', path: 'manuscripts/first-paper' },
      { id: 'second-paper', path: 'manuscripts/second-paper' },
    ]);

    const result = validateOpendraft(config);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('addManuscript — rejections', () => {
  it('rejects an id already listed in opendraft.yml without writing any file', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper', protocol: PROTOCOL });
    const before = await ws.listAll();

    await expect(addManuscript(ws, 'my-paper')).rejects.toThrow();
    expect(await ws.listAll()).toEqual(before);
  });

  it('rejects an id that is not lowercase alphanumeric with hyphens', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper', protocol: PROTOCOL });
    const before = await ws.listAll();

    for (const id of ['My Paper', 'UPPER', '-lead', 'trail-', 'has_underscore']) {
      await expect(addManuscript(ws, id)).rejects.toThrow();
    }
    expect(await ws.listAll()).toEqual(before);
  });
});
