import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { checkCitekeys } from '../src/citekeys.js';

const ARTICLE = '---\nbibliography: ../references.bib\n---\n';
const BIB = '@article{doe2024,\n  title = {T},\n  author = {Doe, J},\n  year = {2024}\n}\n';

async function run(cite: string) {
  const ws = new MemoryWorkspace();
  await ws.writeFile('manuscripts/references.bib', BIB);
  return checkCitekeys(ws, 'manuscripts/demo', ARTICLE, { 'blocks/_a.qmd': `See [@${cite}].` });
}

describe('checkCitekeys', () => {
  it('errors on a missing key', async () => {
    const f = await run('nobody1999');
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain('nobody1999');
  });
  it('is silent when the key is present', async () => {
    expect(await run('doe2024')).toEqual([]);
  });
});
