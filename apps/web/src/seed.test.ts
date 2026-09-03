import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { seedWorkspace, DEFAULT_ARTICLE_PATH, DEFAULT_BLOCK_ID } from './seed';
import { loadManuscript } from './persistence';

describe('seedWorkspace', () => {
  it('writes an authored assembly with the intro include and refs trailer', async () => {
    const workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);

    const article = await workspace.readFile(DEFAULT_ARTICLE_PATH);
    expect(article).toContain(`{{< include blocks/${DEFAULT_BLOCK_ID}.qmd >}}`);
    expect(article).toContain('# References');
  });

  it('writes a non-empty starter block and loads as a manuscript', async () => {
    const workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);

    const blockContent = await workspace.readFile(`blocks/${DEFAULT_BLOCK_ID}.qmd`);
    expect(blockContent).not.toBeNull();
    expect(blockContent!.trim()).not.toBe('');

    const { doc, warnings } = await loadManuscript(workspace);
    expect(warnings).toEqual([]);
    expect(doc.childCount).toBe(1);
    expect(doc.child(0).attrs.id).toBe(DEFAULT_BLOCK_ID);
    expect(doc.child(0).attrs.draft).toBe(false);
  });
});