import { describe, it, expect, vi } from 'vitest';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { sharedBibPath, readReferences } from './references-source';

function ws(content: string | null): WorkspaceAdapter {
  return {
    readFile: vi.fn().mockResolvedValue(content),
    writeFile: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    listFiles: vi.fn().mockResolvedValue([]),
    listAll: vi.fn().mockResolvedValue([]),
  };
}

describe('sharedBibPath', () => {
  it('returns parent references.bib', () => {
    expect(sharedBibPath('manuscripts/p')).toBe('manuscripts/references.bib');
  });
});

describe('readReferences', () => {
  it('parses entries from the given path', async () => {
    const w = ws('@article{doe2024,\n  title = {Test}\n}\n');
    const res = await readReferences(w, 'manuscripts/references.bib');
    expect(w.readFile).toHaveBeenCalledWith('manuscripts/references.bib');
    expect(res.error).toBeNull();
    expect(res.items.map((r) => r.citeKey)).toEqual(['doe2024']);
  });

  it('returns error with line for malformed content', async () => {
    const res = await readReferences(ws('@article{doe2024,\n  title = {Test\n'), 'x.bib');
    expect(res.items).toEqual([]);
    expect(res.error).not.toBeNull();
    expect(typeof res.error?.line).toBe('number');
    expect(res.error?.line).toBeGreaterThan(0);
  });
});
