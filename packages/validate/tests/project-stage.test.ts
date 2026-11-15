import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateProject } from '../src/index.js';

const SHA = 'a'.repeat(40);
const yml = (id: string, path: string): string =>
  `protocol:\n  name: opendraft\n  version: ${SHA}\n  commit: ${SHA}\n  repository: https://github.com/x/y\nmanuscripts:\n  - id: ${id}\n    path: ${path}\n`;

async function run(files: Record<string, string>) {
  const ws = new MemoryWorkspace();
  for (const [p, c] of Object.entries(files)) await ws.writeFile(p, c);
  return validateProject(ws);
}

describe('project stage', () => {
  it('errors when opendraft.yml is missing', async () => {
    const f = await run({});
    expect(f.some((x) => x.level === 'error' && x.path === 'opendraft.yml')).toBe(true);
  });

  it('errors when opendraft.yml fails the schema', async () => {
    const f = await run({ 'opendraft.yml': 'foo: 1\n' });
    expect(f.some((x) => x.level === 'error' && x.path === 'opendraft.yml')).toBe(true);
  });

  it('errors when id differs from directory name', async () => {
    const f = await run({ 'opendraft.yml': yml('a', 'manuscripts/b') });
    expect(f.some((x) => x.level === 'error' && x.message.includes('differs'))).toBe(true);
  });

  it('warns when references.bib is missing', async () => {
    const f = await run({ 'opendraft.yml': yml('a', 'manuscripts/a') });
    expect(f.filter((x) => x.level === 'error')).toEqual([]);
    expect(f.some((x) => x.level === 'warning' && x.path === 'manuscripts/references.bib')).toBe(true);
  });
});
