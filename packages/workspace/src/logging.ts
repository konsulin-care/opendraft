import type { WorkspaceAdapter } from './adapter.js';

/** Minimal logger accepted by {@link withLogging}. */
export interface WorkspaceLogger {
  /** Log a message with optional details. */
  debug(message: string, ...details: unknown[]): void;
}

/**
 * Wrap a workspace adapter so writes and deletes are logged.
 *
 * @param inner - Adapter to forward every call to.
 * @param logger - Logger receiving write/delete events (defaults to console).
 * @returns Adapter with identical behavior plus logging.
 */
export function withLogging(
  inner: WorkspaceAdapter,
  logger: WorkspaceLogger = console,
): WorkspaceAdapter {
  return {
    readFile: (path) => inner.readFile(path),
    writeFile: (path, content) => {
      logger.debug('[workspace] writeFile', path, content.length);
      return inner.writeFile(path, content);
    },
    deleteFile: (path) => {
      logger.debug('[workspace] deleteFile', path);
      return inner.deleteFile(path);
    },
    listFiles: (dir) => inner.listFiles(dir),
    listAll: () => inner.listAll(),
  };
}
