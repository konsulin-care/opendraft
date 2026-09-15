import { describe, it, expect, vi } from 'vitest';
import { createCitationPlugin } from './plugin';
import type { WorkspaceAdapter } from '@opendraft/workspace';

describe('citation plugin integration', () => {
  it('can be imported from index', async () => {
    const module = await import('./index');
    expect(module.createCitationPlugin).toBeDefined();
    expect(module.CitationDropdown).toBeDefined();
  });

  it('creates plugin with workspace', () => {
    const workspace: WorkspaceAdapter = {
      readFile: vi.fn().mockResolvedValue(null),
      writeFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      listFiles: vi.fn().mockResolvedValue([]),
    };

    const plugin = createCitationPlugin(workspace);
    expect(plugin).toBeDefined();
  });
});
