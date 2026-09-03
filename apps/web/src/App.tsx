import { useState, useEffect } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import { IndexedDBWorkspace } from '@opendraft/workspace';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import { CommitDialog } from './components/CommitDialog';
import { seedWorkspace } from './seed';
import { loadManuscript } from './persistence';

const WORKSPACE_ID = 'opendraft-manuscript';

/**
 * App shell: header with commit action plus the single continuous
 * manuscript editor filling the viewport.
 */
export function App() {
  const [workspace, setWorkspace] = useState<IndexedDBWorkspace | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  useEffect(() => {
    let active = true;
    const ws = new IndexedDBWorkspace(WORKSPACE_ID);
    (async () => {
      await seedWorkspace(ws);
      const md = await loadManuscript(ws);
      if (active) {
        setWorkspace(ws);
        setMarkdown(md);
      }
    })().catch((err) => {
      console.error('App boot failed:', err);
    });

    return () => {
      active = false;
      ws.close();
    };
  }, []);

  if (!workspace || markdown === null) {
    return <div>Loading workspace...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
        <h1>OpenDraft</h1>
        <button onClick={() => setShowCommitDialog(true)}>Commit</button>
      </header>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <MilkdownProvider>
          <ManuscriptEditor workspace={workspace} defaultValue={markdown} />
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