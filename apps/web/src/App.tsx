import { useEffect, useState } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { AppHeader } from './components/AppHeader';
import type { SaveStatus } from './components/AppHeader';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import type { EditorMode } from './components/ModeSwitch';
import { CommitDialog } from './components/CommitDialog';
import { ProjectDrawer, useDrawerState } from './components/project-drawer/ProjectDrawer';
import { useProjects } from './hooks/useProjects';
import { useActiveFile } from './hooks/useActiveFile';
import { useToolbarPreference } from './hooks/useToolbarPreference';
import { useEditorMode } from './hooks/useEditorMode';
import { loadFile } from './persistence';

function useCommitDialog() {
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  return { showCommitDialog, setShowCommitDialog };
}

/**
 * Extract the base file name of a repo-relative path.
 *
 * @param path - Repo-relative path such as `manuscripts/p/article.qmd`.
 * @returns The segment after the last slash, e.g. `article.qmd`.
 */
function baseName(path: string): string {
  return path.split('/').pop() ?? path;
}

/**
 * Load the content of the active file. The previous content is dropped
 * synchronously whenever the active path changes so a stale file is never
 * rendered (or saved) under a new path.
 *
 * @param workspace - Workspace of the active project, or null before boot.
 * @param activePath - Repo-relative path of the active file, or null.
 * @returns The loaded `{ path, text }`, or null while loading.
 */
function useActiveFileContent(
  workspace: WorkspaceAdapter | null,
  activePath: string | null,
): { path: string; text: string } | null {
  const [file, setFile] = useState<{ path: string; text: string } | null>(null);

  useEffect(() => {
    if (!workspace || !activePath) {
      setFile(null);
      return undefined;
    }
    let cancelled = false;
    setFile(null);
    loadFile(workspace, activePath).then(
      (text) => {
        if (!cancelled) setFile({ path: activePath, text });
      },
      (err: unknown) => console.error('active file load failed:', err),
    );
    return () => {
      cancelled = true;
    };
  }, [workspace, activePath]);

  return file;
}

/**
 * Always-present editor region. Renders the Milkdown editor once the active
 * file's content has loaded; `file` is null while loading or stale.
 *
 * @param props - Workspace, loaded file and editor wiring.
 */
function EditorArea({
  workspace,
  file,
  mode,
  onSaveStatusChange,
  formattingToolbar,
}: {
  /** Workspace of the active project. */
  workspace: WorkspaceAdapter;
  /** Loaded file, or null while loading or when stale for the active path. */
  file: { path: string; text: string } | null;
  /** Active editor mode. */
  mode: EditorMode;
  /** Reports autosave status changes to the header. */
  onSaveStatusChange: (status: SaveStatus) => void;
  /** Whether the formatting toolbar is shown. */
  formattingToolbar: boolean;
}) {
  return (
    <main style={{ flex: 1, overflow: 'hidden' }}>
      {file && (
        <MilkdownProvider>
          <ManuscriptEditor
            workspace={workspace}
            defaultValue={file.text}
            path={file.path}
            mode={mode}
            onSaveStatusChange={onSaveStatusChange}
            formattingToolbar={formattingToolbar}
          />
        </MilkdownProvider>
      )}
    </main>
  );
}

/**
 * App shell: icon header with commit action plus the single continuous
 * editor for the active project file. Boots into the auto-created
 * "Untitled project" and opens the project's default file.
 */
export function App() {
  const { workspace, active, loading, error } = useProjects();
  const { activePath } = useActiveFile(workspace, active?.id ?? null);
  const { mode, setMode } = useEditorMode();
  const { showCommitDialog, setShowCommitDialog } = useCommitDialog();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const { formattingToolbar, toggleFormattingToolbar } = useToolbarPreference();
  const file = useActiveFileContent(workspace, activePath);
  const drawer = useDrawerState();

  if (loading) return <div>Loading workspace...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!workspace || !activePath) return <div>Empty workspace</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader
        fileName={baseName(activePath)}
        mode={mode}
        onSelectMode={setMode}
        saveStatus={saveStatus}
        formattingToolbar={formattingToolbar}
        onToggleFormattingToolbar={toggleFormattingToolbar}
        onCommit={() => setShowCommitDialog(true)}
        sidebarOpen={drawer.open}
        onToggleSidebar={drawer.toggle}
        toggleButtonRef={drawer.toggleRef}
      />
      <EditorArea
        workspace={workspace}
        file={file !== null && file.path === activePath ? file : null}
        mode={mode}
        onSaveStatusChange={setSaveStatus}
        formattingToolbar={formattingToolbar}
      />
      <ProjectDrawer
        open={drawer.open}
        onClose={drawer.close}
        toggleRef={drawer.toggleRef}
        title={active?.name}
      />
      <CommitDialog
        isOpen={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        onCommit={(message) => console.log('Committed:', message)}
        workspace={workspace}
      />
    </div>
  );
}

export default App;
