import { EditorToolbars } from './EditorToolbars';
import { useEditorCommands } from '../hooks/useEditorCommands';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { OpendraftConfigWarning } from './OpendraftConfigWarning';
import type { SourceEditorHandle } from './SourceEditor';

/** Props for {@link EditorFrame}. */
interface EditorFrameProps {
  /** Editing mode of the rendered surface. */
  editorMode: 'wysiwyg' | 'source';
  /** Formatting-toolbar visibility preference, owned by the app shell. */
  formattingToolbar: boolean;
  /** Workspace path of the edited file (config-warning source). */
  path: string;
  /** Current source markdown (config-warning source). */
  sourceMarkdown: string;
  /** Ref to the source editor handle, used by the toolbar commands. */
  sourceEditorRef: React.RefObject<SourceEditorHandle | null>;
  /** The editor surface to render inside the frame. */
  children: React.ReactNode;
}

/**
 * Chrome shared by the rich and source-only editor variants: the toolbars,
 * the opendraft.yml config warning, and the surface slot.
 *
 * @param props - See {@link EditorFrameProps}.
 */
export function EditorFrame({ editorMode, formattingToolbar, path, sourceMarkdown, sourceEditorRef, children }: EditorFrameProps) {
  const commands = useEditorCommands(editorMode, () => sourceEditorRef.current?.getView() ?? null);
  const { open: keyboardOpen, bottomOffset } = useVirtualKeyboard();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <EditorToolbars
        commands={commands}
        formattingToolbar={formattingToolbar}
        mode={editorMode}
        open={keyboardOpen}
        bottomOffset={bottomOffset}
      />
      <OpendraftConfigWarning path={path} content={sourceMarkdown} />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
