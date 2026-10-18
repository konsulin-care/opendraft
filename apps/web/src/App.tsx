import { useEffect, useState } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { AppHeader } from './components/AppHeader';
import type { SaveStatus } from './components/AppHeader';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import { CommitDialog } from './components/CommitDialog';
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

  if (loading) return <div>Loading workspace...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!workspace || !activePath) return <div>Empty workspace</div>;

  const contentReady = file !== null && file.path === activePath;

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
      />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {contentReady && (
          <MilkdownProvider>
            <ManuscriptEditor
              workspace={workspace}
              defaultValue={file.text}
              path={activePath}
              mode={mode}
              onSaveStatusChange={setSaveStatus}
              formattingToolbar={formattingToolbar}
            />
          </MilkdownProvider>
        )}
      </main>
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
