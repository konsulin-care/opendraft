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

  it('returns the default (toolbar true, wysiwyg) when the key is missing', () => {
    const prefs = readPreferences();
    expect(prefs.v).toBe(PREFERENCES_VERSION);
    expect(prefs.formattingToolbar).toBe(true);
    expect(prefs.editorMode).toBe('wysiwyg');
  });

  it('persists a v2 write so a fresh read returns the stored values', () => {
    writePreferences({ formattingToolbar: false, editorMode: 'source' });
    expect(readPreferences().formattingToolbar).toBe(false);
    expect(readPreferences().editorMode).toBe('source');

    writePreferences({ formattingToolbar: true, editorMode: 'wysiwyg' });
    expect(readPreferences().formattingToolbar).toBe(true);
    expect(readPreferences().editorMode).toBe('wysiwyg');
  });

  it('writes under the opendraft:prefs key as { v: 2, formattingToolbar, editorMode }', () => {
    writePreferences({ formattingToolbar: false, editorMode: 'source' });
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toEqual({
      v: 2,
      formattingToolbar: false,
      editorMode: 'source',
    });
  });

  it('preserves the stored editorMode when a write omits it', () => {
    writePreferences({ formattingToolbar: true, editorMode: 'source' });
    writePreferences({ formattingToolbar: false });
    const prefs = readPreferences();
    expect(prefs.formattingToolbar).toBe(false);
    expect(prefs.editorMode).toBe('source');
  });
});

describe('preferences v1 migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('migrates a v1 payload preserving formattingToolbar and defaulting editorMode to wysiwyg', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 1, formattingToolbar: false }),
    );
    expect(readPreferences()).toEqual({
      v: 2,
      formattingToolbar: false,
      editorMode: 'wysiwyg',
    });
  });

  it('migrates a v1 payload with formattingToolbar true', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 1, formattingToolbar: true }),
    );
    expect(readPreferences()).toEqual({
      v: 2,
      formattingToolbar: true,
      editorMode: 'wysiwyg',
    });
  });

  it('reads back a v2 payload with all fields', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 2, formattingToolbar: false, editorMode: 'source' }),
    );
    expect(readPreferences()).toEqual({
      v: 2,
      formattingToolbar: false,
      editorMode: 'source',
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
    expect(prefs?.editorMode).toBe('wysiwyg');
  });

  it('falls back to the default for a future version without throwing', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 3, formattingToolbar: false, editorMode: 'source' }),
    );
    expect(readPreferences().formattingToolbar).toBe(true);
    expect(readPreferences().editorMode).toBe('wysiwyg');
  });

  it('falls back to the default for an invalid shape without throwing', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 2, formattingToolbar: 'yes', editorMode: 'source' }),
    );
    expect(readPreferences().formattingToolbar).toBe(true);
    expect(readPreferences().editorMode).toBe('wysiwyg');
  });

  it('falls back to the default for an unknown editorMode', () => {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ v: 2, formattingToolbar: false, editorMode: 'vim' }),
    );
    expect(readPreferences().formattingToolbar).toBe(true);
    expect(readPreferences().editorMode).toBe('wysiwyg');
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
    expect(prefs?.editorMode).toBe('wysiwyg');
  });

  it('does not throw when localStorage writes throw', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    expect(() => {
      writePreferences({ formattingToolbar: false, editorMode: 'source' });
    }).not.toThrow();
  });
});
