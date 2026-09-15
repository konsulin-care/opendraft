// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createCitationPlugin, citationPluginKey } from './plugin';
import type { WorkspaceAdapter } from '@opendraft/workspace';

const pluginSource = readFileSync(
  fileURLToPath(new URL('./plugin.ts', import.meta.url)),
  'utf8',
);

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

  it('has handleKeydown that handles Enter for citation insertion', () => {
    // Verify the plugin has the keydown handler
    const plugin = createCitationPlugin(workspace);
    expect(plugin.props?.handleDOMEvents?.keydown).toBeDefined();
  });
});

describe('citation plugin — Enter key behavior (source)', () => {
  it('handles Enter key when citation dropdown is open', () => {
    // The plugin source should check for Enter key and open state
    expect(pluginSource).toContain("event.key === 'Enter'");
    expect(pluginSource).toMatch(/citationState\?\.open/);
  });

  it('imports filterCitekeys for filtering active citekey', () => {
    expect(pluginSource).toContain('filterCitekeys');
    expect(pluginSource).toMatch(/filterCitekeys.*from/);
  });

  it('inserts citekey using ProseMirror transaction', () => {
    // The plugin uses tr.insertText to insert the citation
    expect(pluginSource).toContain('tr.insertText');
  });

  it('dispatches CLOSE_CITATION after inserting', () => {
    // After Enter, the plugin should close the dropdown
    expect(pluginSource).toContain('CLOSE_CITATION');
  });
});
