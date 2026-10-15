import { FormattingToolbar } from './FormattingToolbar';
import { KeyboardBar } from './KeyboardBar';
import type { EditorCommands } from '../editor-commands/types';

/** Props for {@link EditorToolbars}. */
export interface EditorToolbarsProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** Formatting-toolbar visibility preference from the app shell. */
  formattingToolbar: boolean;
  /** True while the on-screen keyboard is open. */
  open?: boolean;
  /** `innerHeight` minus `visualViewport.height`; positions the keyboard bar. */
  bottomOffset?: number;
}

/**
 * Renders the editor toolbars above the editor surface. While the on-screen
 * keyboard is open, only the bottom {@link KeyboardBar} is shown and the top
 * {@link FormattingToolbar} is suppressed. When the keyboard is closed, the
 * formatting toolbar renders if the user preference is on; otherwise nothing
 * is rendered here.
 *
 * @param props - See {@link EditorToolbarsProps}.
 * @returns The keyboard bar or formatting toolbar, or null.
 */
export function EditorToolbars({
  commands,
  formattingToolbar,
  open = false,
  bottomOffset = 0,
}: EditorToolbarsProps) {
  if (open) {
    return (
      <KeyboardBar
        commands={commands}
        open={open}
        bottomOffset={bottomOffset}
        formattingToolbar={formattingToolbar}
      />
    );
  }
  if (!formattingToolbar) return null;
  return <FormattingToolbar commands={commands} />;
}
