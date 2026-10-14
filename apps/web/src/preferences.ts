/**
 * User interface preferences persisted in localStorage.
 *
 * Storage key: `opendraft:prefs`. Payload shape: `{ v: 1, formattingToolbar }`.
 * All reads/writes are defensive: missing, corrupt, wrong-version, or
 * unavailable storage falls back to the default without throwing.
 */

/** localStorage key under which preferences are stored. */
export const PREFERENCES_STORAGE_KEY = 'opendraft:prefs';

/** Current preferences payload version. */
export const PREFERENCES_VERSION = 1;

/** Shape of the persisted preferences payload. */
export interface Preferences {
  /** Payload version; only `1` is read back. */
  v: number;
  /** Whether the formatting toolbar is shown by default. */
  formattingToolbar: boolean;
}

/** Default preferences: formatting toolbar visible. */
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({
  v: PREFERENCES_VERSION,
  formattingToolbar: true,
});

/**
 * Type guard for a valid persisted preferences payload.
 *
 * @param value - Parsed JSON value to check.
 * @returns True when the value is an object with the current version and a
 * boolean `formattingToolbar`.
 */
function isPreferences(value: unknown): value is Preferences {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { v?: unknown; formattingToolbar?: unknown };
  return (
    candidate.v === PREFERENCES_VERSION &&
    typeof candidate.formattingToolbar === 'boolean'
  );
}

/**
 * Read preferences from localStorage.
 *
 * @returns The stored preferences, or the default when the key is missing,
 * the payload is corrupt or has the wrong version, or storage access throws.
 */
export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw === null) {
      return { ...DEFAULT_PREFERENCES };
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isPreferences(parsed)) {
      return { ...DEFAULT_PREFERENCES };
    }
    return { v: PREFERENCES_VERSION, formattingToolbar: parsed.formattingToolbar };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Persist preferences to localStorage.
 *
 * Only `formattingToolbar` is stored; the version is always written as the
 * current one. Errors (e.g. quota exceeded, storage disabled) are swallowed
 * so callers never throw.
 *
 * @param preferences - Preferences to persist.
 */
export function writePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        v: PREFERENCES_VERSION,
        formattingToolbar: preferences.formattingToolbar,
      }),
    );
  } catch {
    // Storage unavailable; preference simply does not persist.
  }
}
