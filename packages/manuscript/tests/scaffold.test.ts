import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateAssembly, validateMetadata, validateOpendraft } from '@opendraft/schema';
import { OPENDRAFT_CONFIG_PATH, SHARED_BIB_PATH, scaffoldProject } from '../src/index';

/** Protocol block the scaffold copies into opendraft.yml. */
const PROTOCOL = {
  name: 'opendraft',
  version: 'f192c95d750b6a71b49134819b08aec509790c84',
  repository: 'https://github.com/konsulin-care/opendraft',
  commit: 'f192c95d750b6a71b49134819b08aec509790c84',
};

/** Manuscript directory written by every fixture. */
const MANUSCRIPT_DIR = 'manuscripts/my-paper';

describe('scaffoldProject — opendraft.yml', () => {
  it('writes the protocol block from options and one manuscript entry at manuscripts/<id>', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper', protocol: PROTOCOL });

    const raw = await ws.readFile(OPENDRAFT_CONFIG_PATH);
    expect(raw).not.toBeNull();

    const config = parse(raw as string);
    expect(config.protocol).toEqual(PROTOCOL);
    expect(config.manuscripts).toEqual([{ id: 'my-paper', path: MANUSCRIPT_DIR }]);

    const result = validateOpendraft(config);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('scaffoldProject — manuscript files', () => {
  it('writes article.qmd and the yml files that pass validateAssembly and validateMetadata', async () => {
    const ws = new MemoryWorkspace();
    await scaffoldProject(ws, { manuscriptId: 'my-paper', protocol: PROTOCOL });

    const article = await ws.readFile(`${MANUSCRIPT_DIR}/article.qmd`);
    expect(article).not.toBeNull();

    const assembly = validateAssembly({ assembly: article as string, blockFiles: {}, files: [] });
    expect(assembly.errors).toEqual([]);
    expect(assembly.valid).toBe(true);

    for (const type of ['author', 'abstract', 'frontmatter'] as const) {
      const raw = await ws.readFile(`${MANUSCRIPT_DIR}/_${type}.yml`);
      expect(raw).not.toBeNull();

      const result = validateMetadata(parse(raw as string), type);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });
});

describe('scaffoldProject — manuscripts/references.bib', () => {
  it('leaves an existing manuscripts/references.bib unchanged', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(SHARED_BIB_PATH, '@misc{keep,}\n');

    await scaffoldProject(ws, { manuscriptId: 'my-paper', protocol: PROTOCOL });

    expect(await ws.readFile(SHARED_BIB_PATH)).toBe('@misc{keep,}\n');
  });
});
