import { describe, it, expect } from 'vitest';
import { folderView } from './folder-view';

describe('folderView', () => {
  it("maps a manuscript root 'manuscripts/<id>' to itself", () => {
    expect(folderView('manuscripts/untitled-project')).toEqual({
      kind: 'manuscript',
      root: 'manuscripts/untitled-project',
    });
  });

  it('maps any folder under a manuscript root to that manuscript root', () => {
    expect(folderView('manuscripts/thesis/blocks')).toEqual({
      kind: 'manuscript',
      root: 'manuscripts/thesis',
    });
    expect(folderView('manuscripts/thesis/blocks/assets')).toEqual({
      kind: 'manuscript',
      root: 'manuscripts/thesis',
    });
  });

  it("maps 'manuscripts' to the overview", () => {
    expect(folderView('manuscripts')).toEqual({ kind: 'overview' });
  });

  it('maps every other folder to not-viewable', () => {
    expect(folderView('notes')).toEqual({ kind: 'unavailable' });
    expect(folderView('assets/images')).toEqual({ kind: 'unavailable' });
    expect(folderView('manuscripts-archive/old')).toEqual({ kind: 'unavailable' });
  });
});
