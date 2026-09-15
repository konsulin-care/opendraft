import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendReference, replaceReference } from './file-write';
import type { WorkspaceAdapter } from '@opendraft/workspace';

function createMockWorkspace(readContent: string | null = null): WorkspaceAdapter {
  return {
    readFile: vi.fn().mockResolvedValue(readContent),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
  };
}

describe('appendReference', () => {
  let workspace: WorkspaceAdapter;

  beforeEach(() => {
    workspace = createMockWorkspace();
  });

  it('creates new file if references.bib does not exist', async () => {
    const entry = '@article{doe2024, title={Test}}';
    await appendReference(workspace, entry);

    expect(workspace.writeFile).toHaveBeenCalledWith(
      'references.bib',
      expect.stringContaining(entry),
    );
  });

  it('appends to existing file', async () => {
    const existing = '@article{smith2023, title={Existing}}';
    workspace = createMockWorkspace(existing);

    const entry = '@article{doe2024, title={New}}';
    await appendReference(workspace, entry);

    expect(workspace.writeFile).toHaveBeenCalledWith(
      'references.bib',
      expect.stringContaining(existing),
    );
    expect(workspace.writeFile).toHaveBeenCalledWith(
      'references.bib',
      expect.stringContaining(entry),
    );
  });

  it('handles empty existing file', async () => {
    workspace = createMockWorkspace('');

    const entry = '@article{doe2024, title={Test}}';
    await appendReference(workspace, entry);

    expect(workspace.writeFile).toHaveBeenCalledWith(
      'references.bib',
      expect.stringContaining(entry),
    );
  });
});

describe('replaceReference', () => {
  it('replaces existing entry by citekey', async () => {
    const existing = `@article{doe2024, title={Old Version}}
@article{smith2023, title={Keep This}}`;
    const workspace = createMockWorkspace(existing);

    const newEntry = '@article{doe2024, title={New Version}}';
    await replaceReference(workspace, 'doe2024', newEntry);

    const written = (workspace.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(written).toContain('New Version');
    expect(written).toContain('smith2023');
    expect(written).not.toContain('Old Version');
  });

  it('appends if citekey not found', async () => {
    const existing = '@article{smith2023, title={Existing}}';
    const workspace = createMockWorkspace(existing);

    const newEntry = '@article{doe2024, title={New}}';
    await replaceReference(workspace, 'doe2024', newEntry);

    const written = (workspace.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(written).toContain('smith2023');
    expect(written).toContain('doe2024');
  });

  it('handles missing file', async () => {
    const workspace = createMockWorkspace(null);

    const newEntry = '@article{doe2024, title={New}}';
    await replaceReference(workspace, 'doe2024', newEntry);

    expect(workspace.writeFile).toHaveBeenCalledWith(
      'references.bib',
      expect.stringContaining(newEntry),
    );
  });
});
