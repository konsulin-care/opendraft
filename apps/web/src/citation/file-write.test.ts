import { describe, it, expect, vi } from 'vitest';
import { appendReference, replaceReference } from './file-write';
import type { WorkspaceAdapter } from '@opendraft/workspace';

const BIB = 'manuscripts/references.bib';

function createMockWorkspace(readContent: string | null = null): WorkspaceAdapter {
  return {
    readFile: vi.fn().mockResolvedValue(readContent),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue([]),
  };
}

function writtenPaths(ws: WorkspaceAdapter): string[] {
  return (ws.writeFile as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
}

describe('appendReference', () => {
  it('creates the given bib file if missing', async () => {
    const ws = createMockWorkspace();
    await appendReference(ws, BIB, '@article{doe2024, title={Test}}');
    expect(ws.readFile).toHaveBeenCalledWith(BIB);
    expect(ws.writeFile).toHaveBeenCalledWith(BIB, expect.stringContaining('doe2024'));
    expect(writtenPaths(ws)).not.toContain('references.bib');
  });

  it('appends to existing content', async () => {
    const ws = createMockWorkspace('@article{smith2023, title={Existing}}');
    await appendReference(ws, BIB, '@article{doe2024, title={New}}');
    const written = (ws.writeFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(written).toContain('smith2023');
    expect(written).toContain('doe2024');
  });
});

describe('replaceReference', () => {
  it('replaces existing entry by citekey in the given bib', async () => {
    const ws = createMockWorkspace(`@article{doe2024, title={Old Version}}
@article{smith2023, title={Keep This}}`);
    await replaceReference(ws, BIB, 'doe2024', '@article{doe2024, title={New Version}}');
    const [path, written] = (ws.writeFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe(BIB);
    expect(written).toContain('New Version');
    expect(written).toContain('smith2023');
    expect(written).not.toContain('Old Version');
  });

  it('appends if citekey not found', async () => {
    const ws = createMockWorkspace('@article{smith2023, title={Existing}}');
    await replaceReference(ws, BIB, 'doe2024', '@article{doe2024, title={New}}');
    expect(writtenPaths(ws)).toEqual([BIB]);
  });

  it('handles missing file', async () => {
    const ws = createMockWorkspace(null);
    await replaceReference(ws, BIB, 'doe2024', '@article{doe2024, title={New}}');
    expect(ws.writeFile).toHaveBeenCalledWith(BIB, expect.stringContaining('doe2024'));
    expect(writtenPaths(ws)).not.toContain('references.bib');
  });
});
