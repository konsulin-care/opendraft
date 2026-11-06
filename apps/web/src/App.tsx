import { useEffect, useState } from 'react';
import type { ProjectRecord, WorkspaceAdapter } from '@opendraft/workspace';
import { AppHeader } from './components/AppHeader';
import type { SaveStatus } from './components/AppHeader';
import { ManuscriptEditor } from './components/ManuscriptEditor';
import { ManuscriptView } from './components/ManuscriptView';
import { CommitDialog } from './components/CommitDialog';
import { ProjectDrawer, useDrawerState } from './components/project-drawer/ProjectDrawer';
import { ProjectSwitcher } from './components/project-drawer/ProjectSwitcher';
import { DeleteProjectAction } from './components/project-drawer/DeleteProjectDialog';
import { FileTree } from './components/project-drawer/FileTree';
import { useProjects, projectRegistry } from './hooks/useProjects';
import { useActiveFile } from './hooks/useActiveFile';
import { useToolbarPreference } from './hooks/useToolbarPreference';
import { loadFile } from './persistence';
import { createOpenManuscriptRenamer } from './project/rename-manuscript';

/** Extract the manuscript directory segment from a repo-relative path, or null. */
function manuscriptDirName(path: string): string | null {
  const [root, dir] = path.split('/');
  return root === 'manuscripts' && dir ? dir : null;
}

/**
 * Load the active file's content, dropping the previous content when the path changes.
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

/** List every file path in the active project's workspace; empty while loading. */
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

/** Props for the always-present editor region. */
interface EditorAreaProps {
  workspace: WorkspaceAdapter;
  activePath: string;
  isDir: boolean;
  file: { path: string; text: string } | null;
  projectId: string;
  onSaveStatusChange: (status: SaveStatus) => void;
  formattingToolbar: boolean;
}

/**
 * Always-present editor region: directories route to the manuscript view
 * (block editor reading column), every file routes to the source-only
 * editor. `file` is null while loading or stale for the active path.
 *
 * @param props - See {@link EditorAreaProps}.
 */
function EditorArea({
  workspace,
  activePath,
  isDir,
  file,
  projectId,
  onSaveStatusChange,
  formattingToolbar,
}: EditorAreaProps) {
  return (
    <main style={{ flex: 1, overflow: 'hidden' }}>
      {isDir ? (
        <ManuscriptView workspace={workspace} dir={activePath} projectKey={projectId} />
      ) : file !== null ? (
        <ManuscriptEditor
          workspace={workspace}
          defaultValue={file.text}
          path={file.path}
          onSaveStatusChange={onSaveStatusChange}
          formattingToolbar={formattingToolbar}
        />
      ) : null}
    </main>
  );
}

/** Props for {@link HeaderSection}. */
interface HeaderSectionProps {
  active: ProjectRecord | null;
  dirName: string | null;
  workspace: WorkspaceAdapter;
  openFile: (path: string) => Promise<void>;
  activePath: string;
  switchTo: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  saveStatus: SaveStatus;
  formattingToolbar: boolean;
  toggleFormattingToolbar: () => void;
  onCommit: () => void;
  drawer: ReturnType<typeof useDrawerState>;
}

/** Icon header with rename, save status, toolbar toggle, commit, and sidebar actions. */
function HeaderSection({
  active, dirName, workspace, openFile, activePath, switchTo,
  rename, saveStatus, formattingToolbar, toggleFormattingToolbar, onCommit, drawer,
}: HeaderSectionProps) {
  return (
    <AppHeader
      projectName={active?.name} manuscriptDir={dirName ?? undefined}
      manuscriptName={dirName !== null ? active?.manuscriptNames?.[dirName] : undefined}
      onRenameProject={active ? (name) => rename(active.id, name) : undefined}
      onRenameManuscript={createOpenManuscriptRenamer(active, dirName, { workspace, registry: projectRegistry, openFile, activePath, refresh: () => switchTo(active.id) })}
      saveStatus={saveStatus}
      formattingToolbar={formattingToolbar}
      onToggleFormattingToolbar={toggleFormattingToolbar}
      onCommit={onCommit}
      sidebarOpen={drawer.open} onToggleSidebar={drawer.toggle} toggleButtonRef={drawer.toggleRef}
    />
  );
}

/** Props for the overlay project drawer section. */
interface DrawerSectionProps {
  projects: ReturnType<typeof useProjects>['projects'];
  active: ReturnType<typeof useProjects>['active'];
  switchTo: (id: string) => void;
  create: (name: string, manuscriptId: string) => void;
  remove: (id: string) => void;
  drawer: ReturnType<typeof useDrawerState>;
  workspace: WorkspaceAdapter;
  paths: string[];
  activePath: string | null;
  onOpen: (path: string) => void;
}

/** Overlay project drawer: switcher header, file tree body, delete action footer. */
function DrawerSection({
  projects,
  active,
  switchTo,
  create,
  remove,
  drawer,
  workspace,
  paths,
  activePath,
  onOpen,
}: DrawerSectionProps) {
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

/** Commit dialog shown after the header's Commit action. */
function CommitSection({
  open,
  onClose,
  workspace,
}: {
  open: boolean;
  onClose: () => void;
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

/** Boot placeholder while the registry loads or failed; null once booted. */
function bootScreen(loading: boolean, error: Error | null) {
  if (loading) return <div>Loading workspace...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return null;
}

/**
 * App shell: icon header with commit action plus the single continuous
 * editor region for the active project path. Boots into the auto-created
 * "Untitled project" and opens the project's default path (the manuscript
 * directory for a fresh scaffold).
 */
export function App() {
  const {
    workspace, projects, active, loading, error, switchTo, create, rename, remove,
  } = useProjects();
  const { activePath, openFile } = useActiveFile(workspace, active?.id ?? null);
  const paths = useWorkspacePaths(workspace, active);
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const { formattingToolbar, toggleFormattingToolbar } = useToolbarPreference();
  // The listing loads asynchronously: until it arrives the active path is
  // treated as unresolved so a directory is never rendered as a file.
  const isDir = activePath !== null && paths.some((p) => p.startsWith(`${activePath}/`));
  const contentPath = activePath !== null && paths.length > 0 && !isDir ? activePath : null;
  const file = useActiveFileContent(workspace, contentPath);
  const drawer = useDrawerState();

  const boot = bootScreen(loading, error);
  if (boot) return boot;
  if (!workspace || !activePath) return <div>Empty workspace</div>;
  const dirName = manuscriptDirName(activePath);

  return (
    <div className="flex h-dvh flex-col">
      <HeaderSection
        active={active} dirName={dirName} workspace={workspace} openFile={openFile}
        activePath={activePath} switchTo={switchTo} rename={rename} saveStatus={saveStatus}
        formattingToolbar={formattingToolbar} toggleFormattingToolbar={toggleFormattingToolbar}
        onCommit={() => setShowCommitDialog(true)} drawer={drawer}
      />
      <EditorArea
        workspace={workspace} activePath={activePath} isDir={isDir}
        file={file !== null && file.path === contentPath ? file : null}
        projectId={active.id} onSaveStatusChange={setSaveStatus}
        formattingToolbar={formattingToolbar}
      />
      <DrawerSection
        projects={projects} active={active} switchTo={switchTo}
        create={create} remove={remove} drawer={drawer}
        workspace={workspace} paths={paths} activePath={activePath} onOpen={openFile}
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
