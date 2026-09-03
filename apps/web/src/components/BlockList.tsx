import { useState, useEffect } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';

interface BlockListProps {
  workspace: WorkspaceAdapter;
  onSelect?: (block: Block) => void;
}

export interface Block {
  id: string;
  title: string;
  file: string;
}

/**
 * Displays all blocks from manifest with selection.
 *
 * @param workspace - Workspace adapter for file I/O
 * @param onSelect - Optional callback invoked when a block is selected
 */
export function BlockList({ workspace, onSelect }: BlockListProps) {
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

  function handleSelect(block: Block) {
    setSelectedId(block.id);
    onSelect?.(block);
  }

  return (
    <div className="block-list">
      <h3>Blocks</h3>
      {blocks.length === 0 ? (
        <p>No blocks</p>
      ) : (
        <ul>
          {blocks.map((block) => (
            <li
              key={block.id}
              className={selectedId === block.id ? 'selected' : ''}
              onClick={() => handleSelect(block)}
            >
              {block.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}