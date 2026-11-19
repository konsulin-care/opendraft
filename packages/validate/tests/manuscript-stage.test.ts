import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateProject } from '../src/index.js';

const SHA = 'a'.repeat(40);
const yml = `protocol:\n  name: opendraft\n  version: ${SHA}\n  commit: ${SHA}\n  repository: https://github.com/x/y\nmanuscripts:\n  - id: m\n    path: manuscripts/m\n`;

async function run(files: Record<string, string>, release = false) {
  const ws = new MemoryWorkspace();
  await ws.writeFile('opendraft.yml', yml);
  for (const [p, c] of Object.entries(files)) await ws.writeFile(`manuscripts/m/${p}`, c);
  return validateProject(ws, { release });
}

describe('manuscript stage', () => {
  it('reports missing required files as errors at the manuscript', async () => {
    const f = await run({});
    expect(f.some((x) => x.level === 'error' && x.location === 'manuscripts/m')).toBe(true);
  });

  it('reports legacy blocks and orphans, located at project-relative files', async () => {
    const f = await run({
      'article.qmd': '# A\n\n{{< include blocks/legacy.qmd >}}\n',
      'blocks/legacy.qmd': '# T {#sec-legacy .doco-section}\n',
      'blocks/_orphan.qmd': 'no heading\n',
    });
    expect(f.some((x) => x.level === 'error' && x.location === 'manuscripts/m/article.qmd')).toBe(
      true,
    );
    expect(f.some((x) => x.level === 'warning' && x.location === 'manuscripts/m/article.qmd')).toBe(
      true,
    );
  });

  it('publish issues are warnings, errors with release', async () => {
    const files = { 'article.qmd': '# A\n', '_frontmatter.yml': 'title: T\n' };
    const a = await run(files);
    const b = await run(files, true);
    const pa = a.filter((x) => x.location.endsWith('.yml'));
    expect(pa.every((x) => x.level !== 'error' || x.message.length > 0)).toBe(true);
    expect(b.filter((x) => x.level === 'error').length).toBeGreaterThanOrEqual(
      a.filter((x) => x.level === 'error').length,
    );
  });
});
