/**
 * User interface preferences persisted in localStorage.
 *
 * Storage key: `opendraft:prefs`. Payload shape: `{ v: 2, formattingToolbar }`.
 * All reads/writes are defensive: missing, corrupt, wrong-version, or
 * unavailable storage falls back to the default without throwing. Legacy
 * payloads (`v: 1`, and `v: 2` payloads still carrying the removed
 * `editorMode` field) migrate to the current shape on read.
 */

/** localStorage key under which preferences are stored. */
export const PREFERENCES_STORAGE_KEY = 'opendraft:prefs';

/** Current preferences payload version. */
export const PREFERENCES_VERSION = 2;

/** Shape of the persisted preferences payload. */
export interface Preferences {
  /** Payload version; only `2` is read back (older payloads migrate on read). */
  v: number;
  /** Whether the formatting toolbar is shown by default. */
  formattingToolbar: boolean;
}

/**
 * Input accepted by {@link writePreferences}. `v` is ignored; the current
 * version is always written.
 */
export interface PreferencesWriteInput {
  /** Ignored; the current version is always written. */
  v?: number;
  /** Formatting toolbar visibility to persist. */
  formattingToolbar: boolean;
}

/** Default preferences: formatting toolbar visible. */
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({
  v: PREFERENCES_VERSION,
  formattingToolbar: true,
});

/**
 * Type guard for the current (v2) persisted payload.
 *
 * @param value - Parsed JSON value to check.
 * @returns True when the value is an object with version 2 and a boolean
 * `formattingToolbar`. A leftover `editorMode` field is ignored.
 */
function isV2Preferences(value: unknown): value is Preferences {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { v?: unknown; formattingToolbar?: unknown };
  return candidate.v === 2 && typeof candidate.formattingToolbar === 'boolean';
}

/**
 * Type guard for a legacy (v1) persisted payload.
 *
 * @param value - Parsed JSON value to check.
 * @returns True when the value is an object with version 1 and a boolean
 * `formattingToolbar`.
 */
function isV1Preferences(value: unknown): value is {
  v: 1;
  formattingToolbar: boolean;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as { v?: unknown; formattingToolbar?: unknown };
  return (
    candidate.v === 1 && typeof candidate.formattingToolbar === 'boolean'
  );
}

/**
 * Migrate a parsed payload to the current version.
 *
 * @param value - Parsed JSON value to migrate.
 * @returns The migrated preferences, or null when the payload is not a known
 * version.
 */
function migrate(value: unknown): Preferences | null {
  if (isV2Preferences(value) || isV1Preferences(value)) {
    return {
      v: PREFERENCES_VERSION,
      formattingToolbar: value.formattingToolbar,
    };
  }
  return null;
}

/**
 * Read preferences from localStorage.
 *
 * @returns The stored preferences (migrated to the current version), or the
 * default when the key is missing, the payload is corrupt or of an unknown
 * version, or storage access throws.
 */
export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw === null) {
      return { ...DEFAULT_PREFERENCES };
    }
    const migrated = migrate(JSON.parse(raw));
    if (migrated === null) {
      return { ...DEFAULT_PREFERENCES };
    }
    return migrated;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Persist preferences to localStorage.
 *
 * `formattingToolbar` is stored as given. The version is always written as
 * the current one. Errors (e.g. quota exceeded, storage disabled) are
 * swallowed so callers never throw.
 *
 * @param preferences - Preferences to persist.
 */
export function writePreferences(preferences: PreferencesWriteInput): void {
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
