/**
 * User interface preferences persisted in localStorage.
 *
 * Storage key: `opendraft:prefs`. Payload shape:
 * `{ v: 2, formattingToolbar, editorMode }`.
 * All reads/writes are defensive: missing, corrupt, wrong-version, or
 * unavailable storage falls back to the default without throwing. Legacy
 * `v: 1` payloads (no `editorMode`) migrate to v2 with `editorMode`
 * defaulting to `wysiwyg`.
 */

/** localStorage key under which preferences are stored. */
export const PREFERENCES_STORAGE_KEY = 'opendraft:prefs';

/** Current preferences payload version. */
export const PREFERENCES_VERSION = 2;

/** Editing surface: the visual (WYSIWYG) editor or the markdown source editor. */
export type EditorMode = 'wysiwyg' | 'source';

/** Shape of the persisted preferences payload. */
export interface Preferences {
  /** Payload version; only `2` is read back (v1 migrates on read). */
  v: number;
  /** Whether the formatting toolbar is shown by default. */
  formattingToolbar: boolean;
  /** Last selected editing surface. */
  editorMode: EditorMode;
}

/**
 * Input accepted by {@link writePreferences}. `editorMode` is optional: when
 * omitted, the currently stored mode is preserved so callers that only change
 * `formattingToolbar` do not clobber the persisted mode. `v` is ignored; the
 * current version is always written.
 */
export interface PreferencesWriteInput {
  /** Ignored; the current version is always written. */
  v?: number;
  /** Formatting toolbar visibility to persist. */
  formattingToolbar: boolean;
  /** Editing surface to persist; defaults to the stored mode. */
  editorMode?: EditorMode;
}

/** Default preferences: formatting toolbar visible, visual editor. */
export const DEFAULT_PREFERENCES: Preferences = Object.freeze({
  v: PREFERENCES_VERSION,
  formattingToolbar: true,
  editorMode: 'wysiwyg',
});

/**
 * Type guard for an {@link EditorMode} value.
 *
 * @param value - Value to check.
 * @returns True for `'wysiwyg'` or `'source'`.
 */
function isEditorMode(value: unknown): value is EditorMode {
  return value === 'wysiwyg' || value === 'source';
}

/**
 * Type guard for the current (v2) persisted payload.
 *
 * @param value - Parsed JSON value to check.
 * @returns True when the value is an object with version 2, a boolean
 * `formattingToolbar`, and a valid `editorMode`.
 */
function isV2Preferences(value: unknown): value is Preferences {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as {
    v?: unknown;
    formattingToolbar?: unknown;
    editorMode?: unknown;
  };
  return (
    candidate.v === 2 &&
    typeof candidate.formattingToolbar === 'boolean' &&
    isEditorMode(candidate.editorMode)
  );
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
 * v2 payloads pass through; v1 payloads keep `formattingToolbar` and default
 * `editorMode` to `wysiwyg`.
 *
 * @param value - Parsed JSON value to migrate.
 * @returns The migrated preferences, or null when the payload is not a known
 * version.
 */
function migrate(value: unknown): Preferences | null {
  if (isV2Preferences(value)) {
    return {
      v: PREFERENCES_VERSION,
      formattingToolbar: value.formattingToolbar,
      editorMode: value.editorMode,
    };
  }
  if (isV1Preferences(value)) {
    return {
      v: PREFERENCES_VERSION,
      formattingToolbar: value.formattingToolbar,
      editorMode: 'wysiwyg',
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
 * `formattingToolbar` is stored as given; `editorMode` is stored when
 * provided, otherwise the currently stored mode is preserved. The version is
 * always written as the current one. Errors (e.g. quota exceeded, storage
 * disabled) are swallowed so callers never throw.
 *
 * @param preferences - Preferences to persist.
 */
export function writePreferences(preferences: PreferencesWriteInput): void {
  try {
    const editorMode = preferences.editorMode ?? readPreferences().editorMode;
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        v: PREFERENCES_VERSION,
        formattingToolbar: preferences.formattingToolbar,
        editorMode,
      }),
    );
  } catch {
    // Storage unavailable; preference simply does not persist.
  }
}
