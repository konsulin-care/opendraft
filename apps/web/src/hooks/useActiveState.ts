import { useCallback, useEffect, useState } from 'react';
import type { ActiveState, EditorCommands } from '../editor-commands/types';

/**
 * Track the formatting state at the current selection for pressed toolbar
 * buttons. Re-reads `commands.activeState()` whenever the document selection
 * changes and whenever the returned refresh callback runs (after a command
 * completes), so `aria-pressed` stays current.
 *
 * @param commands - Command set whose selection state to observe.
 * @returns The latest active state and a refresh callback.
 */
export function useActiveState(
  commands: EditorCommands,
): readonly [ActiveState, () => void] {
  const [state, setState] = useState<ActiveState>(() => commands.activeState());
  const refresh = useCallback(
    () => setState(commands.activeState()),
    [commands],
  );

  useEffect(() => {
    document.addEventListener('selectionchange', refresh);
    return () => document.removeEventListener('selectionchange', refresh);
  }, [refresh]);

  return [state, refresh] as const;
}
