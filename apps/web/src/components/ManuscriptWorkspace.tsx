import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockList, type Block } from './BlockList';
import { Editor } from './Editor';
import { MetadataEditor } from './MetadataEditor';
import { ReferencesEditor } from './ReferencesEditor';

interface ManuscriptWorkspaceProps {
  workspace: WorkspaceAdapter;
  onEditorReady?: ComponentProps<typeof Editor>['onEditorReady'];
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
 * Unified manuscript workspace with sidebar navigation.
 */
export function ManuscriptWorkspace({ workspace, onEditorReady }: ManuscriptWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>('blocks');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [blockContent, setBlockContent] = useState('');

  async function handleSelectBlock(block: Block) {
    const content = await workspace.readFile(`blocks/${block.file}`);
    setBlockContent(content ?? '');
    setSelectedBlock(block);
  }

  async function handleSaveBlock(html: string) {
    if (!selectedBlock) return;
    await workspace.writeFile(`blocks/${selectedBlock.file}`, html);
  }

  return (
    <div className="manuscript-workspace">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="workspace-content">
        {activeTab === 'blocks' && (
          <BlockList workspace={workspace} onSelect={handleSelectBlock} />
        )}
        {activeTab === 'blocks' && (
          selectedBlock ? (
            <Editor
              key={selectedBlock.id}
              workspace={workspace}
              manifestPath="blocks/manifest.json"
              initialContent={blockContent}
              onSave={handleSaveBlock}
              onEditorReady={onEditorReady}
            />
          ) : (
            <div className="block-editor-empty">
              <p>Select a block</p>
            </div>
          )
        )}
        {activeTab === 'metadata' && <MetadataEditor workspace={workspace} />}
        {activeTab === 'references' && <ReferencesEditor workspace={workspace} />}
      </main>
    </div>
  );
}