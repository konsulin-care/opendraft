import { createHash } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateProject } from '../src/index.js';

const PIN = 'b'.repeat(40);
const OLD = 'c'.repeat(40);
const UNKNOWN = 'd'.repeat(40);

const shape = (name: string, sev: string): string => `
<urn:t:${name}> a sh:NodeShape ; sh:targetClass od:Publication ;
  sh:property [ sh:path <urn:t:missing${name}> ; sh:minCount 1 ; sh:severity sh:${sev} ; sh:message "${name} msg" ] .`;
const SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix od: <https://w3id.org/opendraft/ontology#> .
${shape('V', 'Violation')}${shape('W', 'Warning')}${shape('I', 'Info')}
`;
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');
const history = {
  compatibleSince: PIN,
  revisions: [
    { commit: PIN, compatible: true, files: [{ path: 'article.shacl.ttl', sha256: sha(SHAPES) }] },
    { commit: OLD, compatible: false },
  ],
  objects: { [sha(SHAPES)]: SHAPES },
};

const yml = (commit: string): string =>
  `protocol:\n  name: opendraft\n  version: ${commit}\n  commit: ${commit}\n  repository: https://github.com/konsulin-care/opendraft\nmanuscripts:\n  - id: demo\n    path: manuscripts/demo\n`;

async function run(commit: string, extra: Record<string, string> = {}, opts = {}) {
  const ws = new MemoryWorkspace();
  await ws.writeFile('opendraft.yml', yml(commit));
  await ws.writeFile('manuscripts/demo/_frontmatter.yml', 'title: Demo\n');
  await ws.writeFile('manuscripts/demo/article.qmd', '---\ntitle: Demo\n---\n');
  await ws.writeFile('manuscripts/demo/_author.yml', 'author: []\n');
  await ws.writeFile('manuscripts/demo/_abstract.yml', 'abstract: x\n');
  for (const [p, c] of Object.entries(extra)) await ws.writeFile(p, c);
  const f = await validateProject(ws, { history, offline: true, ...opts });
  return f.filter((x) => x.path.includes('urn:t:') || x.message.includes('RDF skipped') || x.path === 'rdf');
}

describe('rdf stage', () => {
  it('maps SHACL severities to finding levels', async () => {
    const f = await run(PIN);
    const by = (m: string) => f.find((x) => x.message === m)?.level;
    expect(by('V msg')).toBe('error');
    expect(by('W msg')).toBe('warning');
    expect(by('I msg')).toBe('info');
  });

  it('skips with a warning when the manuscript has metadata errors', async () => {
    const f = await run(PIN, { 'manuscripts/demo/_author.yml': ': : bad: [' });
    expect(f.some((x) => x.level === 'warning' && x.message.startsWith('RDF skipped:'))).toBe(true);
    expect(f.some((x) => x.message === 'V msg')).toBe(false);
  });

  it('skips and suggests protocol upgrade for an old pin', async () => {
    const f = await run(OLD);
    expect(f.some((x) => x.message.startsWith('RDF skipped:') && x.message.includes('opendraft protocol upgrade'))).toBe(true);
  });

  it('skips when the pin is unavailable', async () => {
    const f = await run(UNKNOWN);
    expect(f.some((x) => x.message.startsWith('RDF skipped:'))).toBe(true);
  });

  it('warns to upgrade opendraft for a fetched unknown pin', async () => {
    const fetch = async () => ({ ok: true, status: 200, text: async () => SHAPES });
    const f = await run(UNKNOWN, {}, { offline: false, fetch });
    expect(f.some((x) => x.level === 'warning' && x.message.includes('upgrade opendraft'))).toBe(true);
  });
});
