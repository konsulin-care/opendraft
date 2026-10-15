import { FormattingToolbar } from './FormattingToolbar';
import type { EditorCommands } from '../editor-commands/types';

/** Props for {@link EditorToolbars}. */
export interface EditorToolbarsProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** Formatting-toolbar visibility preference from the app shell. */
  formattingToolbar: boolean;
}

/**
 * Renders the top formatting toolbar above the editor surface, honouring the
 * user preference. When the preference is off, nothing is rendered here.
 * T11 extends this to swap in the mobile keyboard bar while the on-screen
 * keyboard is open.
 *
 * @param props - See {@link EditorToolbarsProps}.
 * @returns The toolbar, or null when the preference is off.
 */
export function EditorToolbars({ commands, formattingToolbar }: EditorToolbarsProps) {
  if (!formattingToolbar) return null;
  return <FormattingToolbar commands={commands} />;
}
