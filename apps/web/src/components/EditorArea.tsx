import type { ReactNode } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { SaveStatus } from './AppHeader';
import { FolderNotice } from './FolderNotice';
import { ManuscriptOverview } from './ManuscriptOverview';
import { ManuscriptEditor } from './ManuscriptEditor';
import { ManuscriptView } from './ManuscriptView';
import { folderView } from '../project/folder-view';

/** The manuscripts root folder opened by the folder notice's action. */
const MANUSCRIPTS_ROOT = 'manuscripts';

/** Props for {@link EditorArea}. */
export interface EditorAreaProps {
  /** Workspace of the active project. */
  workspace: WorkspaceAdapter;
  /** Repo-relative path of the active file or directory. */
  activePath: string;
  /** True when the active path is a directory (per the workspace listing). */
  isDir: boolean;
  /** Loaded content of the active file, or null while loading or stale. */
  file: { path: string; text: string } | null;
  /** Id of the active project, scoping the block-editor state. */
  projectId: string;
  /** Report save-status changes from the source editor. */
  onSaveStatusChange: (status: SaveStatus) => void;
  /** Whether the formatting toolbar preference is on. */
  formattingToolbar: boolean;
  /** Open a path (used by the folder notice's manuscripts action). */
  openFile: (path: string) => void;
}

/**
 * Render the region body for the active path: directories route through
 * {@link folderView} — manuscript roots and their subfolders open the
 * block editor, the `manuscripts` root opens the overview, every other
 * folder shows the folder notice — and files open the source-only editor
 * while loaded.
 *
 * @param props - See {@link EditorAreaProps}.
 * @returns The body element, or null while a file is loading.
 */
function editorBody({
  workspace, activePath, isDir, file, projectId,
  onSaveStatusChange, formattingToolbar, openFile,
}: EditorAreaProps): ReactNode {
  if (isDir) {
    const view = folderView(activePath);
    if (view.kind === 'manuscript') {
      return <ManuscriptView workspace={workspace} dir={view.root} projectKey={projectId} />;
    }
    if (view.kind === 'overview') {
      return <ManuscriptOverview workspace={workspace} openFile={openFile} />;
    }
    return <FolderNotice onGoToManuscripts={() => openFile(MANUSCRIPTS_ROOT)} />;
  }
  if (file === null) return null;
  return (
    <ManuscriptEditor
      workspace={workspace}
      defaultValue={file.text}
      path={file.path}
      onSaveStatusChange={onSaveStatusChange}
      formattingToolbar={formattingToolbar}
    />
  );
}

/**
 * Always-present editor region: directories route to the manuscript view
 * (block editor reading column), the manuscripts overview or the folder
 * notice, every file routes to the source-only editor. `file` is null
 * while loading or stale for the active path.
 *
 * @param props - See {@link EditorAreaProps}.
 * @returns The `<main>` region holding the routed body.
 */
export function EditorArea(props: EditorAreaProps) {
  return <main style={{ flex: 1, overflow: 'hidden' }}>{editorBody(props)}</main>;
}
