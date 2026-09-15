import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCitationPlugin, citationPluginKey } from './plugin';
import type { WorkspaceAdapter } from '@opendraft/workspace';

describe('createCitationPlugin', () => {
  let workspace: WorkspaceAdapter;

  beforeEach(() => {
    workspace = {
      readFile: vi.fn().mockResolvedValue(null),
      writeFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      listFiles: vi.fn().mockResolvedValue([]),
    };
  });

  it('creates a plugin', () => {
    const plugin = createCitationPlugin(workspace);
    expect(plugin).toBeDefined();
  });

  it('exports pluginKey', () => {
    expect(citationPluginKey).toBeDefined();
  });
});
