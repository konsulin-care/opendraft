import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadTurtle, validateShacl } from '@opendraft/rdf';
import type { TurtleDataset } from '@opendraft/rdf';
import { compileManuscriptGraph } from '../src/rdf/manuscript-graph.js';
import type { ManuscriptSnapshot } from '../src/snapshot.js';

const ARTICLE = fileURLToPath(new URL('../../../protocol/article.shacl.ttl', import.meta.url));
const RELEASE = ARTICLE.replace('article.shacl.ttl', 'article-release.shacl.ttl');
const SHA = '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d';

const BASE: ManuscriptSnapshot = {
  manuscriptId: 'demo',
  manuscriptPath: 'manuscripts/demo',
  repository: 'https://github.com/konsulin-care/opendraft',
  protocolRepository: 'https://github.com/konsulin-care/opendraft',
  protocolCommit: SHA,
  frontmatter: { title: 'Demo', license: 'CC BY 4.0' },
  author: {
    authors: [{ id: 'alice', name: { given: 'Alice', family: 'Smith' }, orcid: '0000-0002-1825-0097',
      email: 'a@example.edu', corresponding: true, affiliations: [{ ref: 'ui' }] }],
    affiliations: [{ id: 'ui', name: 'Universitas Indonesia' }],
  },
  abstract: { abstract: 'An abstract.' },
  sections: [
    { short: 'intro', title: 'Intro', role: 'introduction' },
    { short: 'methods', title: 'Methods', role: null },
  ],
};

async function parse(text: string): Promise<TurtleDataset> {
  const dir = await mkdtemp(join(tmpdir(), 'ms-graph-'));
  const file = join(dir, 'g.ttl');
  await writeFile(file, text, 'utf8');
  return loadTurtle(file);
}

async function violations(text: string, release: boolean): Promise<number> {
  const shapes = await loadTurtle(ARTICLE);
  if (release) for (const q of await loadTurtle(RELEASE)) shapes.add(q);
  const report = await validateShacl(await parse(text), shapes);
  return report.results.filter((r) => r.severity.value.endsWith('Violation')).length;
}

describe('compileManuscriptGraph', () => {
  it('compiles a draft graph rooted at the draft IRI that conforms', async () => {
    const ttl = compileManuscriptGraph(BASE);
    expect(ttl).toContain('<https://w3id.org/opendraft/draft/demo>');
    expect(await violations(ttl, false)).toBe(0);
  });

  it('compiles a release graph rooted at the version DOI that conforms', async () => {
    const ttl = compileManuscriptGraph({
      ...BASE,
      versionDoi: '10.5555/demo-v1',
      conceptDoi: '10.5555/demo',
      sourceRevision: SHA,
    });
    expect(ttl).toContain('<https://doi.org/10.5555/demo-v1>');
    expect(await violations(ttl, true)).toBe(0);
  });

  it('is byte-identical across runs', () => {
    expect(compileManuscriptGraph(BASE)).toBe(compileManuscriptGraph(BASE));
  });
});
