import { describe, expect, it, vi } from 'vitest';
import { clearIntent, intentPath } from './intent-url';
import type { IntentWindow } from './intent-url';

describe('intentPath', () => {
  it('adds intent=edit to a bare repository route', () => {
    expect(intentPath({ owner: 'konsulin-care', repo: 'citizen-science' })).toBe(
      '/konsulin-care/citizen-science?intent=edit',
    );
  });

  it('keeps the /tree/<ref> suffix', () => {
    expect(intentPath({ owner: 'o', repo: 'r', ref: 'main' })).toBe('/o/r/tree/main?intent=edit');
  });

  it('keeps a ref that contains slashes', () => {
    expect(intentPath({ owner: 'o', repo: 'r', ref: 'feature/x' })).toBe(
      '/o/r/tree/feature/x?intent=edit',
    );
  });

  it('keeps the manuscript query parameter before intent', () => {
    expect(intentPath({ owner: 'o', repo: 'r', ref: 'main' }, 'ms-1')).toBe(
      '/o/r/tree/main?manuscript=ms-1&intent=edit',
    );
  });

  it('omits an empty manuscript id', () => {
    expect(intentPath({ owner: 'o', repo: 'r' }, '')).toBe('/o/r?intent=edit');
  });
});

describe('clearIntent', () => {
  it('removes only intent and keeps the other query parameters', () => {
    const win: IntentWindow = {
      location: { href: 'https://opendraft.dev/o/r/tree/main?manuscript=ms-1&intent=edit#top' },
      history: { state: { from: 'reader' }, replaceState: vi.fn() },
    };

    clearIntent(win);

    expect(win.history.replaceState).toHaveBeenCalledWith(
      { from: 'reader' },
      '',
      '/o/r/tree/main?manuscript=ms-1#top',
    );
  });

  it('drops the query separator when intent was the only parameter', () => {
    const win: IntentWindow = {
      location: { href: 'https://opendraft.dev/o/r?intent=edit' },
      history: { state: null, replaceState: vi.fn() },
    };

    clearIntent(win);

    expect(win.history.replaceState).toHaveBeenCalledWith(null, '', '/o/r');
  });
});
