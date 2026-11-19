import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { loadManuscriptSnapshot } from '../src/snapshot.js';

async function setup(): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(
    'opendraft.yml',
    'repository: https://github.com/o/r\nconcept-doi: 10.5281/zenodo.1\nprotocol:\n  repository: https://github.com/o/p\n  commit: abc\nmanuscripts: []\n',
  );
  const d = 'manuscripts/demo';
  await ws.writeFile(`${d}/article.qmd`, '{{< include blocks/_intro.qmd >}}\n');
  await ws.writeFile(`${d}/blocks/_intro.qmd`, '# Intro {#sec-intro .deo-introduction}\n\nText\n');
  await ws.writeFile(`${d}/_frontmatter.yml`, 'title: T\n');
  await ws.writeFile(`${d}/_author.yml`, 'authors: []\n');
  await ws.writeFile(`${d}/_abstract.yml`, 'abstract: A\n');
  return ws;
}

describe('loadManuscriptSnapshot', () => {
  it('returns metadata and sections in include order', async () => {
    const s = await loadManuscriptSnapshot(await setup(), { id: 'demo', path: 'manuscripts/demo' }, {});
    expect(s.frontmatter.title).toBe('T');
    expect(s.author.authors).toEqual([]);
    expect(s.abstract.abstract).toBe('A');
    expect(s.sections).toEqual([{ short: 'intro', title: 'Intro', role: 'introduction' }]);
  });

  it('reads opendraft.yml and leaves sourceRevision undefined', async () => {
    const entry = { id: 'demo', path: 'manuscripts/demo' };
    const s = await loadManuscriptSnapshot(await setup(), entry, {});
    expect(s.repository).toBe('https://github.com/o/r');
    expect(s.protocolRepository).toBe('https://github.com/o/p');
    expect(s.protocolCommit).toBe('abc');
    expect(s.conceptDoi).toBe('10.5281/zenodo.1');
    expect(s.sourceRevision).toBeUndefined();
    const t = await loadManuscriptSnapshot(await setup(), entry, { sourceRevision: 'x' });
    expect(t.sourceRevision).toBe('x');
  });
});
