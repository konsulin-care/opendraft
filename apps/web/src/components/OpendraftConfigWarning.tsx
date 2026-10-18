import type { CSSProperties } from 'react';
import { parse } from 'yaml';
import { validateOpendraft } from '@opendraft/schema';

/** Props for {@link OpendraftConfigWarning}. */
export interface OpendraftConfigWarningProps {
  /** Active workspace path of the file being edited. */
  path: string;
  /** Current text content of that file. */
  content: string;
}

/** Shared inline style for the warning block. */
const ALERT_STYLE: CSSProperties = {
  padding: '8px 12px',
  margin: '8px 12px',
  border: '1px solid #f59e0b',
  borderRadius: '4px',
  backgroundColor: '#fef3c7',
  color: '#92400e',
  fontSize: '13px',
};

/**
 * True when a workspace path points at the project config file, matching on
 * the basename so nested paths like `docs/opendraft.yml` also count.
 *
 * @param path - Repo-relative workspace path.
 * @returns Whether the path is the opendraft.yml config file.
 */
function isConfigPath(path: string): boolean {
  return path.split('/').pop() === 'opendraft.yml';
}

/**
 * Inline warning shown while the active `opendraft.yml` fails YAML parsing
 * or schema validation. Purely presentational: it never blocks editing or
 * autosave, and renders nothing for other files or for valid config content.
 *
 * @param props - See {@link OpendraftConfigWarningProps}.
 * @returns A `role="alert"` block listing schema error paths, or the parse
 * error message, or `null` when there is nothing to warn about.
 */
export function OpendraftConfigWarning({ path, content }: OpendraftConfigWarningProps) {
  if (!isConfigPath(path)) return null;

  let config: unknown;
  try {
    config = parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return (
      <div role="alert" style={ALERT_STYLE}>
        <strong>opendraft.yml could not be parsed</strong>
        <div>{message}</div>
      </div>
    );
  }

  const { valid, errors } = validateOpendraft(config);
  if (valid) return null;
  return (
    <div role="alert" style={ALERT_STYLE}>
      <strong>opendraft.yml has schema errors</strong>
      <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
        {errors.map((error) => (
          <li key={error.path}>
            {error.path}: {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
