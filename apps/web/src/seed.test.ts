import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { seedWorkspace, STARTER_MANUSCRIPT, DEFAULT_ARTICLE_PATH } from './seed';
import { loadManuscript } from './persistence';

describe('seedWorkspace', () => {
  it('writes a single starter manuscript markdown file', async () => {
    const workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);

    const article = await workspace.readFile(DEFAULT_ARTICLE_PATH);
    expect(article).toBe(`${STARTER_MANUSCRIPT.trimEnd()}\n`);
  });

  it('starts from a blank manuscript without block machinery', () => {
    expect(STARTER_MANUSCRIPT).toBe('');
    expect(STARTER_MANUSCRIPT).not.toContain('{{< include');
    expect(STARTER_MANUSCRIPT).not.toContain('blocks/');
    expect(STARTER_MANUSCRIPT).not.toMatch(/\{#/);
  });

  it('is idempotent and loads back as one markdown document', async () => {
    const workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);
    await seedWorkspace(workspace);

    expect(await loadManuscript(workspace)).toBe(`${STARTER_MANUSCRIPT.trimEnd()}\n`);
    expect(await workspace.readFile('article.qmd')).toBeNull();
    expect(await workspace.readFile('blocks/intro.qmd')).toBeNull();
  });
});