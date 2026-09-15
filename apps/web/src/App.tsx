import { useState, useEffect, useCallback } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import { IndexedDBWorkspace } from '@opendraft/workspace';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import { CommitDialog } from './components/CommitDialog';
import { seedWorkspace } from './seed';
import { loadManuscript } from './persistence';

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

function useWorkspace() {
  const [workspace, setWorkspace] = useState<IndexedDBWorkspace | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const ws = new IndexedDBWorkspace(WORKSPACE_ID);
    (async () => {
      try {
        await seedWorkspace(ws);
        const md = await loadManuscript(ws);
        if (active) {
          setWorkspace(ws);
          setMarkdown(md);
        }
      } catch (err) {
        console.error('App boot failed:', err);
      }
    })();

    return () => {
      active = false;
      ws.close();
    };
  }, []);

  return { workspace, markdown };
}

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
  const { workspace, markdown } = useWorkspace();
  const { mode, toggleMode } = useMode();
  const { showCommitDialog, setShowCommitDialog } = useCommitDialog();

  if (!workspace || markdown === null) {
    return <div>Loading workspace...</div>;
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
