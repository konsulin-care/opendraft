import { useState, useCallback } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import { CommitDialog } from './components/CommitDialog';
import { useWorkspace } from './hooks/useWorkspace';

interface HeaderProps {
  mode: 'wysiwyg' | 'source';
  onToggleMode: () => void;
  onCommit: () => void;
}

function Header({ mode, onToggleMode, onCommit }: HeaderProps) {
  return (
    <header style={{ padding: '1rem', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>  
      <h1>OpenDraft</h1>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>  
        <button onClick={onToggleMode}>
          {mode === 'wysiwyg' ? 'Source' : 'Visual'}
        </button>
        <button onClick={onCommit}>Commit</button>
      </div>
    </header>
  );
}

const WORKSPACE_ID = 'opendraft-manuscript';

function useMode() {
  const [mode, setMode] = useState<'wysiwyg' | 'source'>('wysiwyg');
  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'wysiwyg' ? 'source' : 'wysiwyg'));
  }, []);
  return { mode, toggleMode };
}

function useCommitDialog() {
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  return { showCommitDialog, setShowCommitDialog };
}

/**
 * App shell: header with commit action plus the single continuous
 * manuscript editor filling the viewport.
 */
export function App() {
  const { workspace, markdown, loading, error } = useWorkspace(WORKSPACE_ID);
  const { mode, toggleMode } = useMode();
  const { showCommitDialog, setShowCommitDialog } = useCommitDialog();

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
      <Header mode={mode} onToggleMode={toggleMode} onCommit={() => setShowCommitDialog(true)} />
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