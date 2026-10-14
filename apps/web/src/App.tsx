import { useState } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import { AppHeader } from './components/AppHeader';
import type { EditorMode } from './components/AppHeader';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import { CommitDialog } from './components/CommitDialog';
import { useWorkspace } from './hooks/useWorkspace';
import { useToolbarPreference } from './hooks/useToolbarPreference';
import { MANUSCRIPT_PATH } from './persistence';

const WORKSPACE_ID = 'opendraft-manuscript';

function useMode() {
  const [mode, setMode] = useState<EditorMode>('wysiwyg');
  return { mode, setMode };
}

function useCommitDialog() {
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  return { showCommitDialog, setShowCommitDialog };
}

/**
 * App shell: icon header with commit action plus the single continuous
 * manuscript editor filling the viewport.
 */
export function App() {
  const { workspace, markdown, loading, error } = useWorkspace(WORKSPACE_ID);
  const { mode, setMode } = useMode();
  const { showCommitDialog, setShowCommitDialog } = useCommitDialog();
  const { formattingToolbar, toggleFormattingToolbar } = useToolbarPreference();

  if (loading) {
    return <div>Loading workspace...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!workspace || markdown === null) {
    return <div>Empty workspace</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader
        fileName={MANUSCRIPT_PATH}
        mode={mode}
        onSelectMode={setMode}
        formattingToolbar={formattingToolbar}
        onToggleFormattingToolbar={toggleFormattingToolbar}
        onCommit={() => setShowCommitDialog(true)}
      />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <MilkdownProvider>
          <ManuscriptEditor workspace={workspace} defaultValue={markdown} mode={mode} />
        </MilkdownProvider>
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
