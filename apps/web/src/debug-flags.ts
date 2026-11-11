/** localStorage key listing enabled debug channels (comma/space separated). */
export const DEBUG_KEY = 'opendraft:debug';

/**
 * Check whether a debug channel is enabled via localStorage.
 *
 * @param channel - Channel name, e.g. 'workspace'.
 * @returns True when `opendraft:debug` lists the channel.
 */
export function isDebugEnabled(channel: string): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(DEBUG_KEY);
    if (!raw) return false;
    return raw.split(/[\s,]+/).filter(Boolean).includes(channel);
  } catch {
    return false;
  }
}
