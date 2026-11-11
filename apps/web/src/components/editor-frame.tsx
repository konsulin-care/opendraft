import { EditorToolbars } from './EditorToolbars';
import { useEditorCommands } from '../hooks/useEditorCommands';
import { useVirtualKeyboard } from '../hooks/useVirtualKeyboard';
import { OpendraftConfigWarning } from './OpendraftConfigWarning';
import type { SourceEditorHandle } from './SourceEditor';

/** Props for {@link EditorFrame}. */
interface EditorFrameProps {
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
 * Chrome shared by the source-only editor: the toolbars (bound to the
 * source command set, so the formatting controls stay disabled), the
 * opendraft.yml config warning, and the surface slot.
 *
 * @param props - See {@link EditorFrameProps}.
 */
export function EditorFrame({ path, sourceMarkdown, sourceEditorRef, children }: EditorFrameProps) {
  const commands = useEditorCommands('source', () => sourceEditorRef.current?.getView() ?? null);
  const { open: keyboardOpen, bottomOffset } = useVirtualKeyboard();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <EditorToolbars
        commands={commands}
        open={keyboardOpen}
        bottomOffset={bottomOffset}
      />
      <OpendraftConfigWarning path={path} content={sourceMarkdown} />
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
