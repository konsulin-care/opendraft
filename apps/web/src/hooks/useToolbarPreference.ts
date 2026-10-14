import { useCallback, useEffect, useState } from 'react';
import {
  PREFERENCES_VERSION,
  readPreferences,
  writePreferences,
} from '../preferences';

/** Keyboard shortcut that toggles the formatting toolbar: Mod+\ . */
const SHORTCUT_KEY = '\\';

/**
 * Whether the current platform is an Apple platform where Cmd is the primary
 * keyboard modifier (macOS, iOS).
 *
 * @returns True when `navigator` reports an Apple platform.
 */
function isApplePlatform(): boolean {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform =
    nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Value returned by {@link useToolbarPreference}. */
export interface ToolbarPreference {
  /** Current formatting-toolbar visibility preference. */
  formattingToolbar: boolean;
  /** Flip the preference and persist it to localStorage. */
  toggleFormattingToolbar: () => void;
}

/**
 * Hook that exposes the persisted formatting-toolbar preference, a toggle,
 * and binds the Mod+\ keyboard shortcut (Ctrl on non-Mac, Cmd on Mac) to
 * toggle and persist it.
 *
 * The initial value is read synchronously from localStorage
 * (`opendraft:prefs`); missing or corrupt storage falls back to the default.
 *
 * @returns The current preference and a toggle function.
 */
export function useToolbarPreference(): ToolbarPreference {
  const [formattingToolbar, setFormattingToolbar] = useState(
    () => readPreferences().formattingToolbar,
  );

  const toggleFormattingToolbar = useCallback(() => {
    const next = !formattingToolbar;
    setFormattingToolbar(next);
    writePreferences({ v: PREFERENCES_VERSION, formattingToolbar: next });
  }, [formattingToolbar]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== SHORTCUT_KEY && event.code !== 'Backslash') {
        return;
      }
      const modPressed = isApplePlatform() ? event.metaKey : event.ctrlKey;
      if (!modPressed) {
        return;
      }
      event.preventDefault();
      toggleFormattingToolbar();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFormattingToolbar]);

  return { formattingToolbar, toggleFormattingToolbar };
}
