import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  writePreferences,
} from './preferences';

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns the default (formattingToolbar true) when the key is missing', () => {
    const prefs = readPreferences();
    expect(prefs.formattingToolbar).toBe(true);
  });

  it('persists a write so a fresh read returns the stored value', () => {
    writePreferences({ v: 1, formattingToolbar: false });
    expect(readPreferences().formattingToolbar).toBe(false);

    writePreferences({ v: 1, formattingToolbar: true });
    expect(readPreferences().formattingToolbar).toBe(true);
  });

  it('writes under the opendraft:prefs key as { v: 1, formattingToolbar }', () => {
    writePreferences({ v: 1, formattingToolbar: false });
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({ v: 1, formattingToolbar: false });
  });
});

describe('preferences fallbacks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('falls back to the default for corrupt JSON without throwing', () => {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, '{not json');
    let prefs: ReturnType<typeof readPreferences> | undefined;
    expect(() => {
      prefs = readPreferences();
    }).not.toThrow();
    expect(prefs?.formattingToolbar).toBe(true);
  });

  it('falls back to the default for a wrong version without throwing', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 2, formattingToolbar: false }),
    );
    expect(readPreferences().formattingToolbar).toBe(true);
  });

  it('falls back to the default for an invalid shape without throwing', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 1, formattingToolbar: 'yes' }),
    );
    expect(readPreferences().formattingToolbar).toBe(true);
  });
});

describe('preferences with unavailable storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns the default when localStorage reads throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    let prefs: ReturnType<typeof readPreferences> | undefined;
    expect(() => {
      prefs = readPreferences();
    }).not.toThrow();
    expect(prefs?.formattingToolbar).toBe(true);
  });

  it('does not throw when localStorage writes throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => {
      writePreferences({ v: 1, formattingToolbar: false });
    }).not.toThrow();
  });
});
