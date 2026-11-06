import { useCallback, useEffect, useRef, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { useSaveShortcut } from '../hooks/useSaveShortcut';
import { SourceEditor, type SourceEditorHandle } from './SourceEditor';
import { EditorFrame } from './editor-frame';
import { getFileCapability } from '../project/file-capability';
import { useDebouncedSaver } from './editor/autosave';
import type { SaveStatus } from './AppHeader';
import { ReadingColumn } from './ReadingColumn';

export type { EditorTestApi } from '../caret-mode-switch';

/** Props for {@link ManuscriptEditor}. */
interface ManuscriptEditorProps {
  /** Workspace adapter used for autosave persistence. */
  workspace: WorkspaceAdapter;
  /** Initial content; must be ready before mount. */
  defaultValue: string;
  /** Workspace path this editor autosaves to; pending edits flush to the old path on change. */
  path: string;
  /** Reports autosave progress: saving, saved, or error. */
  onSaveStatusChange?: (status: SaveStatus) => void;
  /** Formatting-toolbar visibility preference, owned by the app shell. */
  formattingToolbar?: boolean;
}

/**
 * Editor-safe buffer for a file: binary content is blanked so the bytes
 * never reach the source editor.
 *
 * @param path - Repo-relative file path.
 * @param content - Raw file content.
 * @returns The content, or an empty string for binary files.
 */
function editorContent(path: string, content: string): string {
  return getFileCapability(path, content) === 'binary' ? '' : content;
}

/**
 * Source-only editor for every workspace file: a CodeMirror surface that
 * never creates a Crepe/Milkdown instance, so files are never rewritten
 * by a round trip. Pending debounced saves flush to the old path before
 * switching files.
 *
 * @param props - See {@link ManuscriptEditorProps}.
 * @returns The source-only editor inside the shared editor frame.
 */
export function ManuscriptEditor({
  workspace,
  defaultValue,
  path,
  onSaveStatusChange,
  formattingToolbar = true,
}: ManuscriptEditorProps) {
  const [sourceMarkdown, setSourceMarkdown] = useState(() => editorContent(path, defaultValue));
  const sourceEditorRef = useRef<SourceEditorHandle | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const saver = useDebouncedSaver(workspace, path, onSaveStatusChange);
  // Cmd/Ctrl+S flushes the pending debounced save immediately.
  useSaveShortcut(saver);
  useFocusScrollGuard(scrollContainerRef);

  // Reload the buffer when the open file changes.
  useEffect(() => {
    setSourceMarkdown(editorContent(path, defaultValue));
  }, [path, defaultValue]);

  // Source edits schedule the same debounced autosave as before.
  const handleSourceChange = useCallback((md: string) => {
    setSourceMarkdown(md);
    saver.schedule(md);
  }, [saver]);

  return (
    <EditorFrame
      formattingToolbar={formattingToolbar}
      path={path}
      sourceMarkdown={sourceMarkdown}
      sourceEditorRef={sourceEditorRef}
    >
      <div className="manuscript-editor" data-testid="manuscript-editor">
        <div ref={scrollContainerRef} tabIndex={-1} style={{ height: '100%', overflow: 'auto' }}>
          <ReadingColumn>
            <SourceEditor
              ref={sourceEditorRef}
              value={sourceMarkdown}
              onChange={handleSourceChange}
              className="source-editor"
              language="plain"
            />
          </ReadingColumn>
        </div>
      </div>
    </EditorFrame>
  );
}
