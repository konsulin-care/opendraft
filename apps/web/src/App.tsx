import { useState, useEffect } from 'react';
import { IndexedDBWorkspace } from '@opendraft/workspace';
import { ManuscriptWorkspace } from './components/ManuscriptWorkspace';
import { CommitDialog } from './components/CommitDialog';

const WORKSPACE_ID = 'opendraft-manuscript';

export function App() {
  const [workspace, setWorkspace] = useState<IndexedDBWorkspace | null>(null);
  const [showCommitDialog, setShowCommitDialog] = useState(false);

  useEffect(() => {
    setWorkspace(new IndexedDBWorkspace(WORKSPACE_ID));
  }, []);

  if (!workspace) {
    return <div>Loading workspace...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between' }}>
        <h1>OpenDraft</h1>
        <button onClick={() => setShowCommitDialog(true)}>Commit</button>
      </header>
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <ManuscriptWorkspace workspace={workspace} />
      </main>
      <CommitDialog
        isOpen={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        onCommit={(message) => console.log('Committed:', message)}
        workspace={workspace}
        manifestPath="blocks/manifest.json"
      />
    </div>
  );
}

export default App;
