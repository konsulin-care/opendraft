import { useRef } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from '../block-editor/BlockEditor';
import { useEditorCommands } from '../hooks/useEditorCommands';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { useToolbarPreference } from '../hooks/useToolbarPreference';
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
 * Reading view for a manuscript directory: one scroll container (the
 * panel's scroll-collapse driver) holding the editor toolbars whose
 * formatting commands dispatch to the focused block editor, the metadata
 * panel on top of the block list, and the block editor underneath — all
 * guarded against focus-scroll jumps. The surface keeps exactly one child
 * so the scroll container remains the single scrollport.
 *
 * @param props - See {@link ManuscriptViewProps}.
 * @returns The manuscript-view surface with one scroll container.
 */
export function ManuscriptView({ workspace, dir, projectKey }: ManuscriptViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useFocusScrollGuard(scrollContainerRef);
  // Formatting commands target the most recently focused block editor.
  const commands = useEditorCommands('wysiwyg', () => null);
  const { formattingToolbar } = useToolbarPreference();
  return (
    <div className="manuscript-editor" data-testid="manuscript-view">
      <div
        ref={scrollContainerRef}
        tabIndex={-1}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        <EditorToolbars commands={commands} formattingToolbar={formattingToolbar} />
        <MetadataPanel
          workspace={workspace}
          manuscriptRoot={dir}
          projectKey={projectKey}
          editorFocusRef={scrollContainerRef}
        />
        <ReadingColumn>
          <BlockEditor ws={workspace} dir={dir} projectKey={projectKey} />
        </ReadingColumn>
      </div>
    </div>
  );
}
