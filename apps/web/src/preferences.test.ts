import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PREFERENCES_STORAGE_KEY,
  PREFERENCES_VERSION,
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

  it('returns the default (toolbar true) when the key is missing', () => {
    const prefs = readPreferences();
    expect(prefs.v).toBe(PREFERENCES_VERSION);
    expect(prefs.formattingToolbar).toBe(true);
  });

  it('persists a v2 write so a fresh read returns the stored values', () => {
    writePreferences({ formattingToolbar: false });
    expect(readPreferences().formattingToolbar).toBe(false);

    writePreferences({ formattingToolbar: true });
    expect(readPreferences().formattingToolbar).toBe(true);
  });

  it('writes under the opendraft:prefs key as { v: 2, formattingToolbar }', () => {
    writePreferences({ formattingToolbar: false });
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      v: 2,
      formattingToolbar: false,
    });
  });

  it('carries no editorMode field anywhere in the payload', () => {
    writePreferences({ formattingToolbar: true });
    const stored = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) as string);
    expect(Object.keys(stored)).toEqual(['v', 'formattingToolbar']);
    expect('editorMode' in readPreferences()).toBe(false);
  });
});

/** Seed a legacy v1 payload and assert the migrated read. */
function expectV1Migration(formattingToolbar: boolean): void {
  localStorage.setItem(
    PREFERENCES_STORAGE_KEY,
    JSON.stringify({ v: 1, formattingToolbar }),
  );
  expect(readPreferences()).toEqual({
    v: 2,
    formattingToolbar,
  });
}

describe('preferences legacy migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('migrates a v1 payload preserving formattingToolbar', () => {
    expectV1Migration(false);
  });

  it('migrates a v1 payload with formattingToolbar true', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 1, formattingToolbar: true }),
    );
    expect(readPreferences()).toEqual({
      v: 2,
      formattingToolbar: true,
    });
  });

  it('migrates a v2 payload still carrying a leftover editorMode field', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 2, formattingToolbar: false, editorMode: 'source' }),
    );
    expect(readPreferences()).toEqual({
      v: 2,
      formattingToolbar: false,
    });
  });

  it('reads back a v2 payload with all fields', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 2, formattingToolbar: false }),
    );
    expect(readPreferences()).toEqual({
      v: 2,
      formattingToolbar: false,
    });
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

  it('falls back to the default for a future version without throwing', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 3, formattingToolbar: false }),
    );
    expect(readPreferences().formattingToolbar).toBe(true);
  });

  it('falls back to the default for an invalid shape without throwing', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 2, formattingToolbar: 'yes' }),
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
      writePreferences({ formattingToolbar: false });
    }).not.toThrow();
  });
});
