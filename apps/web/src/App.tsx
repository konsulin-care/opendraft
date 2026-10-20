import { useEffect, useState } from 'react';
import { MilkdownProvider } from '@milkdown/react';
import type { ProjectRecord, WorkspaceAdapter } from '@opendraft/workspace';
import { AppHeader } from './components/AppHeader';
import type { SaveStatus } from './components/AppHeader';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import type { EditorMode } from './components/ModeSwitch';
import { CommitDialog } from './components/CommitDialog';
import { ProjectDrawer, useDrawerState } from './components/project-drawer/ProjectDrawer';
import { ProjectSwitcher } from './components/project-drawer/ProjectSwitcher';
import { DeleteProjectAction } from './components/project-drawer/DeleteProjectDialog';
import { FileTree } from './components/project-drawer/FileTree';
import { useProjects, projectRegistry } from './hooks/useProjects';
import { useActiveFile } from './hooks/useActiveFile';
import { useToolbarPreference } from './hooks/useToolbarPreference';
import { useEditorMode } from './hooks/useEditorMode';
import { loadFile } from './persistence';
import { createOpenManuscriptRenamer } from './project/rename-manuscript';

/**
 * Extract the manuscript directory name from a repo-relative path.
 *
 * @param path - Repo-relative path such as `manuscripts/p/article.qmd`.
 * @returns The directory segment under `manuscripts/`, or null.
 */
function manuscriptDirName(path: string): string | null {
  const [root, dir] = path.split('/');
  return root === 'manuscripts' && dir ? dir : null;
}

/**
 * Load the content of the active file. The previous content is dropped
 * synchronously whenever the active path changes so a stale file is never
 * rendered (or saved) under a new path.
 *
 * @param workspace - Workspace of the active project, or null before boot.
 * @param activePath - Repo-relative path of the active file, or null.
 * @returns The loaded `{ path, text }`, or null while loading.
 */
function useActiveFileContent(
  workspace: WorkspaceAdapter | null,
  activePath: string | null,
): { path: string; text: string } | null {
  const [file, setFile] = useState<{ path: string; text: string } | null>(null);

  useEffect(() => {
    if (!workspace || !activePath) {
      setFile(null);
      return undefined;
    }
    let cancelled = false;
    setFile(null);
    loadFile(workspace, activePath).then(
      (text) => {
        if (!cancelled) setFile({ path: activePath, text });
      },
      (err: unknown) => console.error('active file load failed:', err),
    );
    return () => {
      cancelled = true;
    };
  }, [workspace, activePath]);

  return file;
}

/**
 * List every file path in the active project's workspace.
 *
 * @param workspace - Workspace of the active project, or null before boot.
 * @param active - Active project record; changes (e.g. a manuscript rename) re-list the workspace.
 * @returns Repo-relative paths of all workspace files, empty while loading.
 */
function useWorkspacePaths(workspace: WorkspaceAdapter | null, active: ProjectRecord | null): string[] {
  const [paths, setPaths] = useState<string[]>([]);

  useEffect(() => {
    if (!workspace) {
      setPaths([]);
      return undefined;
    }
    let cancelled = false;
    workspace.listAll().then(
      (list) => {
        if (!cancelled) setPaths(list);
      },
      (err: unknown) => console.error('workspace file listing failed:', err),
    );
    return () => {
      cancelled = true;
    };
  }, [workspace, active]);

  return paths;
}

/**
 * Always-present editor region. Renders the Milkdown editor once the active
 * file's content has loaded; `file` is null while loading or stale.
 *
 * @param props - Workspace, loaded file and editor wiring.
 */
function EditorArea({
  workspace,
  file,
  mode,
  onSaveStatusChange,
  formattingToolbar,
}: {
  /** Workspace of the active project. */
  workspace: WorkspaceAdapter;
  /** Loaded file, or null while loading or when stale for the active path. */
  file: { path: string; text: string } | null;
  /** Active editor mode. */
  mode: EditorMode;
  /** Reports autosave status changes to the header. */
  onSaveStatusChange: (status: SaveStatus) => void;
  /** Whether the formatting toolbar is shown. */
  formattingToolbar: boolean;
}) {
  return (
    <main style={{ flex: 1, overflow: 'hidden' }}>
      {file && (
        <MilkdownProvider>
          <ManuscriptEditor
            workspace={workspace}
            defaultValue={file.text}
            path={file.path}
            mode={mode}
            onSaveStatusChange={onSaveStatusChange}
            formattingToolbar={formattingToolbar}
          />
        </MilkdownProvider>
      )}
    </main>
  );
}

/** Props for the overlay project drawer section. */
interface DrawerSectionProps {
  /** All registered projects. */
  projects: ReturnType<typeof useProjects>['projects'];
  /** The active project, or null when none. */
  active: ReturnType<typeof useProjects>['active'];
  /** Make the given project active. */
  switchTo: (id: string) => void;
  /** Register and scaffold a new project. */
  create: (name: string, manuscriptId: string) => void;
  /** Remove a project. */
  remove: (id: string) => void;
  /** Drawer open state and toggle wiring. */
  drawer: ReturnType<typeof useDrawerState>;
  /** Workspace of the active project. */
  workspace: WorkspaceAdapter;
  /** Repo-relative path of the active file, or null. */
  activePath: string | null;
  /** Open a file in the editor. */
  onOpen: (path: string) => void;
}

/**
 * Overlay project drawer with the project switcher pinned in its header,
 * the active project's file tree as its body, and the delete action in
 * its footer.
 *
 * @param props - Projects, active project, registry actions, drawer state,
 *   workspace, active file path and the open-file handler.
 */
function DrawerSection({
  projects,
  active,
  switchTo,
  create,
  remove,
  drawer,
  workspace,
  activePath,
  onOpen,
}: DrawerSectionProps) {
  const paths = useWorkspacePaths(workspace, active);
  return (
    <ProjectDrawer
      open={drawer.open}
      onClose={drawer.close}
      toggleRef={drawer.toggleRef}
      title={active?.name}
      header={
        <ProjectSwitcher
          projects={projects}
          active={active}
          switchTo={switchTo}
          create={create}
        />
      }
      footer={
        active ? (
          <DeleteProjectAction project={active} onConfirm={remove} />
        ) : undefined
      }
    >
      <FileTree
        paths={paths}
        workspace={workspace}
        activePath={activePath}
        onOpen={onOpen}
      />
    </ProjectDrawer>
  );
}

/**
 * Commit dialog, shown after the header's Commit action.
 *
 * @param props - Dialog visibility, close handler, and the workspace to commit.
 */
function CommitSection({
  open,
  onClose,
  workspace,
}: {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Close the dialog. */
  onClose: () => void;
  /** Workspace committed to. */
  workspace: WorkspaceAdapter;
}) {
  return (
    <CommitDialog
      isOpen={open}
      onClose={onClose}
      onCommit={(message) => console.log('Committed:', message)}
      workspace={workspace}
    />
  );
}

/**
 * App shell: icon header with commit action plus the single continuous
 * editor for the active project file. Boots into the auto-created
 * "Untitled project" and opens the project's default file.
 */
export function App() {
  const {
    workspace, projects, active, loading, error, switchTo, create, rename, remove,
  } = useProjects();
  const { activePath, openFile } = useActiveFile(workspace, active?.id ?? null);
  const { mode, setMode } = useEditorMode();
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const { formattingToolbar, toggleFormattingToolbar } = useToolbarPreference();
  const file = useActiveFileContent(workspace, activePath);
  const drawer = useDrawerState();

  if (loading) return <div>Loading workspace...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!workspace || !activePath) return <div>Empty workspace</div>;
  const dirName = manuscriptDirName(activePath);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader
        projectName={active?.name} manuscriptDir={dirName ?? undefined}
        manuscriptName={dirName !== null ? active?.manuscriptNames?.[dirName] : undefined}
        onRenameProject={active ? (name) => rename(active.id, name) : undefined}
        onRenameManuscript={createOpenManuscriptRenamer(active, dirName, { workspace, registry: projectRegistry, openFile, activePath, refresh: () => switchTo(active.id) })}
        mode={mode} onSelectMode={setMode} saveStatus={saveStatus}
        formattingToolbar={formattingToolbar}
        onToggleFormattingToolbar={toggleFormattingToolbar}
        onCommit={() => setShowCommitDialog(true)}
        sidebarOpen={drawer.open} onToggleSidebar={drawer.toggle} toggleButtonRef={drawer.toggleRef}
      />
      <EditorArea
        workspace={workspace}
        file={file !== null && file.path === activePath ? file : null}
        mode={mode}
        onSaveStatusChange={setSaveStatus}
        formattingToolbar={formattingToolbar}
      />
      <DrawerSection
        projects={projects} active={active} switchTo={switchTo}
        create={create} remove={remove} drawer={drawer}
        workspace={workspace} activePath={activePath} onOpen={openFile}
      />
      <CommitSection
        open={showCommitDialog}
        onClose={() => setShowCommitDialog(false)}
        workspace={workspace}
      />
    </div>
  );
}

export default App;
