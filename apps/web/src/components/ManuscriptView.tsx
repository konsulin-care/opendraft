import { useRef } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { BlockEditor } from '../block-editor/BlockEditor';
import { useFocusScrollGuard } from '../hooks/useFocusScrollGuard';

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
 * Reading view for a manuscript directory: the block editor inside the
 * shared reading column, in a single scroll container guarded against
 * focus-scroll jumps.
 *
 * @param props - See {@link ManuscriptViewProps}.
 * @returns The manuscript-view surface with one scroll container.
 */
export function ManuscriptView({ workspace, dir, projectKey }: ManuscriptViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  useFocusScrollGuard(scrollContainerRef);
  return (
    <div className="manuscript-editor" data-testid="manuscript-view">
      <div
        ref={scrollContainerRef}
        tabIndex={-1}
        style={{ height: '100%', overflow: 'auto' }}
      >
        <div className="reading-column">
          <BlockEditor ws={workspace} dir={dir} projectKey={projectKey} />
        </div>
      </div>
    </div>
  );
}
