import { lazy, Suspense, useRef } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditorSkeleton } from '../block-editor/BlockEditorSkeleton';
import { ReadOnlyContext } from '../block-editor/read-only-context';
import { useEditorCommands } from '../hooks/useEditorCommands';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';
import { ReaderMetadata } from '../reader/ReaderMetadata';
import { EditorToolbars } from './EditorToolbars';
import { ReadingColumn } from './ReadingColumn';

// React.lazy requires a default export; both components are named exports.
const BlockEditor = lazy(() =>
  import('../block-editor/BlockEditor').then((m) => ({ default: m.BlockEditor })),
);
const MetadataPanel = lazy(() =>
  import('./metadata-panel/MetadataPanel').then((m) => ({ default: m.MetadataPanel })),
);

/** Props for {@link ManuscriptView}. */
export interface ManuscriptViewProps {
  /** Workspace holding the manuscript files. */
  workspace: WorkspaceAdapter;
  /** Manuscript directory, e.g. `manuscripts/<id>`. */
  dir: string;
  /** Project key scoping the persisted block-editor state. */
  projectKey: string;
  /** Render the reader view: no toolbars, read-only blocks and metadata. */
  readOnly?: boolean;
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
 * In read-only mode the editor toolbars are omitted, the editable metadata
 * panel is replaced by the presentational reader metadata and the block
 * editor is wrapped in {@link ReadOnlyContext} so no add-block controls
 * render.
 *
 * @param props - See {@link ManuscriptViewProps}.
 * @returns The manuscript-view surface: toolbars first, then one scroll container.
 */
export function ManuscriptView({
  workspace,
  dir,
  projectKey,
  readOnly = false,
}: ManuscriptViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useFocusScrollGuard(scrollContainerRef);
  // Formatting commands target the most recently focused block editor.
  const commands = useEditorCommands('wysiwyg', () => null);
  return (
    <div className="manuscript-editor" data-testid="manuscript-view">
      {!readOnly && <EditorToolbars commands={commands} />}
      <div
        ref={scrollContainerRef}
        tabIndex={-1}
        style={{ flex: 1, minHeight: 0, overflow: 'auto' }}
      >
        <ReadingColumn>
          {readOnly ? (
            <ReaderMetadata workspace={workspace} manuscriptRoot={dir} />
          ) : (
            <Suspense fallback={null}>
              <MetadataPanel
                workspace={workspace}
                manuscriptRoot={dir}
                projectKey={projectKey}
                editorFocusRef={scrollContainerRef}
              />
            </Suspense>
          )}
          <ReadOnlyContext.Provider value={readOnly}>
            <Suspense fallback={<BlockEditorSkeleton />}>
              <BlockEditor ws={workspace} dir={dir} projectKey={projectKey} />
            </Suspense>
          </ReadOnlyContext.Provider>
        </ReadingColumn>
      </div>
    </div>
  );
}
