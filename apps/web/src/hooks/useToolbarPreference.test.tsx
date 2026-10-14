import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolbarPreference } from './useToolbarPreference';
import { PREFERENCES_STORAGE_KEY, readPreferences, writePreferences } from '../preferences';

/**
 * Dispatch a keydown event on window.
 *
 * @param key - The `key` value of the event.
 * @param init - Additional KeyboardEventInit flags (ctrlKey, metaKey, ...).
 */
function press(key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    }),
  );
}

/**
 * Override `navigator.platform` with an own property so platform detection
 * can be exercised under jsdom. Deleted in afterEach to restore the prototype
 * getter.
 *
 * @param platform - Platform string to expose, e.g. 'MacIntel'.
 */
function mockPlatform(platform: string): void {
  Object.defineProperty(navigator, 'platform', {
    value: platform,
    configurable: true,
  });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete (navigator as { platform?: string }).platform;
  localStorage.clear();
});

describe('useToolbarPreference preference and toggle', () => {
  it('defaults to true when nothing is stored', () => {
    const { result } = renderHook(() => useToolbarPreference());
    expect(result.current.formattingToolbar).toBe(true);
  });

  it('initial value equals the stored preference', () => {
    writePreferences({ v: 1, formattingToolbar: false });
    const { result } = renderHook(() => useToolbarPreference());
    expect(result.current.formattingToolbar).toBe(false);
  });

  it('toggle flips the value and persists it under opendraft:prefs', () => {
    const { result } = renderHook(() => useToolbarPreference());

    act(() => {
      result.current.toggleFormattingToolbar();
    });
    expect(result.current.formattingToolbar).toBe(false);
    expect(readPreferences().formattingToolbar).toBe(false);
    expect(
      JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) as string),
    ).toEqual({ v: 1, formattingToolbar: false });

    act(() => {
      result.current.toggleFormattingToolbar();
    });
    expect(result.current.formattingToolbar).toBe(true);
    expect(readPreferences().formattingToolbar).toBe(true);
  });
});

describe('useToolbarPreference Mod+\\ shortcut', () => {
  it('keydown Ctrl+\\ flips the value and updates localStorage (non-Mac)', () => {
    mockPlatform('Linux x86_64');
    const { result } = renderHook(() => useToolbarPreference());
    expect(result.current.formattingToolbar).toBe(true);

    act(() => {
      press('\\', { ctrlKey: true });
    });
    expect(result.current.formattingToolbar).toBe(false);
    expect(readPreferences().formattingToolbar).toBe(false);

    act(() => {
      press('\\', { ctrlKey: true });
    });
    expect(result.current.formattingToolbar).toBe(true);
    expect(readPreferences().formattingToolbar).toBe(true);
  });

  it('keydown Meta+\\ flips the value on Mac platform', () => {
    mockPlatform('MacIntel');
    const { result } = renderHook(() => useToolbarPreference());

    act(() => {
      press('\\', { metaKey: true });
    });
    expect(result.current.formattingToolbar).toBe(false);
    expect(readPreferences().formattingToolbar).toBe(false);
  });

  it('other keys do nothing', () => {
    const { result } = renderHook(() => useToolbarPreference());

    act(() => {
      press('j', { ctrlKey: true });
      press('\\');
      press('Enter', { ctrlKey: true });
    });
    expect(result.current.formattingToolbar).toBe(true);
    expect(localStorage.getItem(PREFERENCES_STORAGE_KEY)).toBeNull();
  });
});
