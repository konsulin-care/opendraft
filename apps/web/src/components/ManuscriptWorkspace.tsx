import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { ManuscriptEditor } from './ManuscriptEditor';
import { MetadataEditor } from './MetadataEditor';
import { ReferencesEditor } from './ReferencesEditor';

interface ManuscriptWorkspaceProps {
  workspace: WorkspaceAdapter;
  onEditorReady?: ComponentProps<typeof ManuscriptEditor>['onEditorReady'];
}

type Tab = 'blocks' | 'metadata' | 'references';

function Sidebar({ activeTab, onTabChange }: { activeTab: Tab; onTabChange: (tab: Tab) => void }) {
  return (
    <nav className="sidebar">
      <h2>Manuscript</h2>
      <ul>
        <li className={activeTab === 'blocks' ? 'active' : ''} onClick={() => onTabChange('blocks')}>Blocks</li>
        <li className={activeTab === 'metadata' ? 'active' : ''} onClick={() => onTabChange('metadata')}>Metadata</li>
        <li className={activeTab === 'references' ? 'active' : ''} onClick={() => onTabChange('references')}>References</li>
      </ul>
    </nav>
  );
}

/**
 * Manuscript workspace: continuous whole-document editor plus the
 * metadata and references side tabs.
 */
export function ManuscriptWorkspace({ workspace, onEditorReady }: ManuscriptWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('blocks');

  return (
    <div className="manuscript-workspace">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="workspace-content">
        {activeTab === 'blocks' && <ManuscriptEditor workspace={workspace} onEditorReady={onEditorReady} />}
        {activeTab === 'metadata' && <MetadataEditor workspace={workspace} />}
        {activeTab === 'references' && <ReferencesEditor workspace={workspace} />}
      </main>
    </div>
  );
}