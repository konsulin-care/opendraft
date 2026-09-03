import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { ManuscriptEditor } from './ManuscriptEditor';
import { BlockRail } from './BlockRail';
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
 * Manuscript workspace: block rail + continuous editor, with the
 * metadata and references side tabs.
 */
export function ManuscriptWorkspace({ workspace, onEditorReady }: ManuscriptWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('blocks');
  const [railVersion, setRailVersion] = useState(0);

  return (
    <div className="manuscript-workspace">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="workspace-content">
        {activeTab === 'blocks' && (
          <div className="manuscript-page">
            <BlockRail workspace={workspace} version={railVersion} />
            <ManuscriptEditor
              workspace={workspace}
              onEditorReady={onEditorReady}
              onSaved={() => setRailVersion((version) => version + 1)}
            />
          </div>
        )}
        {activeTab === 'metadata' && <MetadataEditor workspace={workspace} />}
        {activeTab === 'references' && <ReferencesEditor workspace={workspace} />}
      </main>
    </div>
  );
}