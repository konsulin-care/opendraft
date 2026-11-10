import { useRef } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from '../block-editor/BlockEditor';
import { useEditorCommands } from '../hooks/useEditorCommands';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { EditorToolbars } from './EditorToolbars';
import { MetadataPanel } from './metadata-panel/MetadataPanel';
import { ReadingColumn } from './ReadingColumn';

/** Props for {@link ManuscriptView}. */
export interface ManuscriptViewProps {
  /** Workspace holding the manuscript files. */
  workspace: WorkspaceAdapter;
  /** Manuscript directory, e.g. `manuscripts/<id>`. */
  dir: string;
  /** Project key scoping the persisted block-editor state. */
  projectKey: string;
}

/**
 * Reading view for a manuscript directory: the editor toolbars whose
 * formatting commands dispatch to the focused block editor rendered as the
 * surface's first child — outside the one scroll container (the panel's
 * scroll-collapse driver) so scrolling never hides them — and one shared
 * ReadingColumn holding the metadata panel on top of the block list inside
 * that overflow-auto scrollport, so the title block and the blocks share
 * one display configuration, all guarded against focus-scroll jumps.
 *
 * @param props - See {@link ManuscriptViewProps}.
 * @returns The manuscript-view surface: toolbars first, then one scroll container.
 */
export function ManuscriptView({ workspace, dir, projectKey }: ManuscriptViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useFocusScrollGuard(scrollContainerRef);
  // Formatting commands target the most recently focused block editor.
  const commands = useEditorCommands('wysiwyg', () => null);
  return (
    <div className="manuscript-editor" data-testid="manuscript-view">
      <EditorToolbars commands={commands} />
      <div
        ref={scrollContainerRef}
        tabIndex={-1}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        <ReadingColumn>
          <MetadataPanel
            workspace={workspace}
            manuscriptRoot={dir}
            projectKey={projectKey}
            editorFocusRef={scrollContainerRef}
          />
          <BlockEditor ws={workspace} dir={dir} projectKey={projectKey} />
        </ReadingColumn>
      </div>
    </div>
  );
}
