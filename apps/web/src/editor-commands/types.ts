/** Heading level for {@link EditorCommands.setHeading}; 0 means plain paragraph. */
export type BlockLevel = 0 | 1 | 2 | 3;

/** Formatting state at the current selection, used for pressed buttons. */
export interface ActiveState {
  /** Inside strong (bold) text. */
  bold: boolean;
  /** Inside emphasis (italic) text. */
  italic: boolean;
  /** Inside strikethrough text. */
  strike: boolean;
  /** Inside inline code. */
  inlineCode: boolean;
  /** Inside a link. */
  link: boolean;
  /** Current block heading level, 0 for paragraph. */
  heading: BlockLevel;
  /** Inside a bullet list. */
  bulletList: boolean;
  /** Inside an ordered list. */
  orderedList: boolean;
  /** Inside a blockquote. */
  blockquote: boolean;
}

/** Active state with nothing pressed; used when the editor is not ready. */
export const INACTIVE_STATE: ActiveState = {
  bold: false,
  italic: false,
  strike: false,
  inlineCode: false,
  link: false,
  heading: 0,
  bulletList: false,
  orderedList: false,
  blockquote: false,
};

/**
 * Editor-agnostic formatting API used by the toolbar and keyboard bar.
 * Implemented once for the Milkdown WYSIWYG surface and once for the
 * CodeMirror source surface, which supports undo and redo only.
 */
export interface EditorCommands {
  /** False when formatting actions are unavailable (source mode). */
  readonly canFormat: boolean;
  /** Undo the last change. */
  undo(): void;
  /** Redo the last undone change. */
  redo(): void;
  /** Toggle strong (bold) on the selection. */
  toggleBold(): void;
  /** Toggle emphasis (italic) on the selection. */
  toggleItalic(): void;
  /** Toggle strikethrough on the selection. */
  toggleStrike(): void;
  /** Toggle inline code on the selection. */
  toggleInlineCode(): void;
  /** Toggle a link on the selection. */
  toggleLink(): void;
  /** Insert an @ citation trigger at the cursor. */
  insertCitation(): void;
  /** Insert an inline math placeholder at the cursor. */
  inlineMath(): void;
  /** Set the current block to a paragraph (0) or heading level 1-3. */
  setHeading(level: BlockLevel): void;
  /** Wrap the current block in a bullet list. */
  bulletList(): void;
  /** Wrap the current block in an ordered list. */
  orderedList(): void;
  /** Start a GFM task-list item on the current line. */
  taskList(): void;
  /** Wrap the current block in a blockquote. */
  blockquote(): void;
  /** Turn the current block into a code block. */
  codeBlock(): void;
  /** Insert a 3x3 table at the cursor. */
  table(): void;
  /** Insert a horizontal rule. */
  hr(): void;
  /** Insert an empty image block (uploads are handled separately). */
  image(): void;
  /** Read formatting state at the selection. */
  activeState(): ActiveState;
}
