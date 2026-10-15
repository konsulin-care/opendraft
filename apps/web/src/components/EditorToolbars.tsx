import { useEffect, useState } from 'react';
import { FormattingToolbar } from './FormattingToolbar';
import { KeyboardBar } from './KeyboardBar';
import type { EditorCommands } from '../editor-commands/types';

/** Props for {@link EditorToolbars}. */
export interface EditorToolbarsProps {
  /** Command set bound to the active editor surface. */
  commands: EditorCommands;
  /** Formatting-toolbar visibility preference from the app shell. */
  formattingToolbar: boolean;
  /** Current editing surface; the toolbar only shows in wysiwyg mode. */
  mode?: 'wysiwyg' | 'source';
  /** True while the on-screen keyboard is open. */
  open?: boolean;
  /** `innerHeight` minus `visualViewport.height`; positions the keyboard bar. */
  bottomOffset?: number;
}

/** Milliseconds the toolbar stays mounted after closing so it can collapse. */
const COLLAPSE_MS = 150;

/**
 * Renders the editor toolbars above the editor surface. While the on-screen
 * keyboard is open, only the bottom {@link KeyboardBar} is shown and the top
 * {@link FormattingToolbar} is suppressed. Otherwise the formatting toolbar
 * renders inside a `.editor-toolbar-collapse` container that animates closed
 * over 150 ms: the toolbar stays mounted for the transition duration, then
 * unmounts. Under `prefers-reduced-motion` the CSS transition is dropped.
 *
 * @param props - See {@link EditorToolbarsProps}.
 * @returns The keyboard bar, or the collapse container with the toolbar.
 */
export function EditorToolbars({
  commands,
  formattingToolbar,
  mode = 'wysiwyg',
  open = false,
  bottomOffset = 0,
}: EditorToolbarsProps) {
  // Effective visibility: the stored preference is gated on wysiwyg mode.
  // Mode switches must not rewrite the stored preference itself.
  const effectiveToolbar = formattingToolbar && mode === 'wysiwyg';
  const [mountedToolbar, setMountedToolbar] = useState(effectiveToolbar);

  useEffect(() => {
    if (effectiveToolbar) {
      setMountedToolbar(true);
      return undefined;
    }
    const timer = setTimeout(() => setMountedToolbar(false), COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [effectiveToolbar]);

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
  return (
    <div className={`editor-toolbar-collapse ${effectiveToolbar ? 'is-open' : 'is-closed'}`}>
      {mountedToolbar && <FormattingToolbar commands={commands} />}
    </div>
  );
}
