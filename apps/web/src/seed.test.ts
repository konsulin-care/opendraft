import { describe, it, expect } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { validateManifest } from '@opendraft/schema';
import { seedWorkspace, DEFAULT_MANIFEST_PATH, DEFAULT_BLOCK_ID } from './seed';

describe('seedWorkspace', () => {
  it('writes a schema-valid manifest with one block', async () => {
    const workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);

    const manifestContent = await workspace.readFile(DEFAULT_MANIFEST_PATH);
    expect(manifestContent).not.toBeNull();

    const manifest = JSON.parse(manifestContent!);
    expect(validateManifest(manifest).valid).toBe(true);
    expect(manifest.blocks).toEqual([{
      id: DEFAULT_BLOCK_ID,
      file: `${DEFAULT_BLOCK_ID}.qmd`,
      title: 'Introduction',
    }]);
  });

  it('writes a non-empty starter block file', async () => {
    const workspace = new MemoryWorkspace();
    await seedWorkspace(workspace);

    const blockContent = await workspace.readFile(`blocks/${DEFAULT_BLOCK_ID}.qmd`);
    expect(blockContent).not.toBeNull();
    expect(blockContent!.trim()).not.toBe('');
  });
});