import { useState, useEffect } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';

interface BlockListProps {
  workspace: WorkspaceAdapter;
}

interface Block {
  id: string;
  title: string;
  file: string;
}

/**
 * Displays all blocks from manifest with selection.
 */
export function BlockList({ workspace }: BlockListProps) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadBlocks();
  }, [workspace]);

  async function loadBlocks() {
    const manifestContent = await workspace.readFile('blocks/manifest.json');
    if (!manifestContent) return;
    const manifest = JSON.parse(manifestContent);
    setBlocks(manifest.blocks || []);
  }

  return (
    <div className="block-list">
      <h3>Blocks</h3>
      <ul>
        {blocks.map((block) => (
          <li
            key={block.id}
            className={selectedId === block.id ? 'selected' : ''}
            onClick={() => setSelectedId(block.id)}
          >
            {block.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
