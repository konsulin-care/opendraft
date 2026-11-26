import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProjectRecord, ProjectSource, WorkspaceAdapter } from '@opendraft/workspace';
import type { BffSession, Owner } from './github/bff-client';
import { listOwners } from './github/bff-client';
import { AppHeader } from './components/AppHeader';
import type { SaveStatus } from './components/AppHeader';
import type { ManuscriptSwitcherOption } from './components/header/ManuscriptSwitcher';
import { EditorArea } from './components/EditorArea';
import { useDraftSection } from './hooks/use-draft-section';
import type { HeaderStatus } from './hooks/draft-header-status';
import { createDraftSectionDeps } from './suggest/draft-deps';
import { ProjectDrawer, useDrawerState } from './components/project-drawer/ProjectDrawer';
import { ProjectSwitcher } from './components/project-drawer/ProjectSwitcher';
import { DeleteProjectAction } from './components/project-drawer/DeleteProjectDialog';
import { FileTree } from './components/project-drawer/FileTree';
import { useProjects, projectRegistry } from './hooks/useProjects';
import { useActiveFile } from './hooks/useActiveFile';
import { useSession } from './hooks/use-session';
import { loadFile } from './persistence';
import { createOpenManuscriptRenamer } from './project/rename-manuscript';

/** Window event announcing a block mutation so the shell re-lists workspace files. */
const FILES_CHANGED_EVENT = 'opendraft:files-changed';

/** Extract the manuscript directory segment from a repo-relative path, or null. */
function manuscriptDirName(path: string): string | null {
  const [root, dir] = path.split('/');
  return root === 'manuscripts' && dir ? dir : null;
}

/**
 * List the manuscript folders under `manuscripts/` as switcher options.
 *
 * @param paths - Every repo-relative path in the workspace.
 * @param active - The active project, supplying display names.
 * @returns Sorted switcher options, one per manuscript folder.
 */
function manuscriptOptions(
  paths: string[],
  active: ProjectRecord | null,
): ManuscriptSwitcherOption[] {
  const ids = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/').filter((segment) => segment !== '');
    if (segments[0] === 'manuscripts' && segments.length >= 3) ids.add(segments[1]);
  }
  return [...ids].sort().map((id) => ({
    id,
    title: active?.manuscriptNames?.[id] ?? id,
  }));
}

/** Resolve whether the active path is a directory and which file to render. */
function resolveContentPath(
  activePath: string | null,
  paths: string[],
): { isDir: boolean; contentPath: string | null } {
  const isDir = activePath !== null && paths.some((p) => p.startsWith(`${activePath}/`));
  const contentPath = activePath !== null && paths.length > 0 && !isDir ? activePath : null;
  return { isDir, contentPath };
}

/** Load the GitHub accounts the signed-in viewer can publish to. */
function useOwners(session: BffSession | null): Owner[] {
  const [owners, setOwners] = useState<Owner[]>([]);
  useEffect(() => {
    if (session === null) { setOwners([]); return; }
    void listOwners().then(setOwners, () => undefined);
  }, [session]);
  return owners;
}
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
function useWorkspacePaths(workspace: WorkspaceAdapter | null, active: ProjectRecord | null): string[] {
  const [paths, setPaths] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener(FILES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!workspace) { setPaths([]); return undefined; }
    let cancelled = false;
    workspace.listAll().then(
      (list) => {
        if (!cancelled) setPaths(list);
      },
      (err: unknown) => console.error('workspace file listing failed:', err),
    );
    return () => { cancelled = true; };
  }, [workspace, active, version]);

  return paths;
}
/** Props for {@link HeaderSection}. */
interface HeaderSectionProps {
  active: ProjectRecord | null;
  source?: ProjectSource;
  dirName: string | null;
  workspace: WorkspaceAdapter;
  openFile: (path: string) => Promise<void>;
  activePath: string;
  switchTo: (id: string) => Promise<void>;
  saveStatus: SaveStatus;
  status: HeaderStatus | null;
  manuscripts: readonly ManuscriptSwitcherOption[];
  onSelectManuscript: (id: string) => void;
  onSelectAllManuscripts: () => void;
  session: BffSession | null;
  loginEnabled: boolean;
  onLogout: () => void;
  returnTo: string;
  action?: ReactNode;
  drawer: ReturnType<typeof useDrawerState>;
}

function HeaderSection({
  active, source, dirName, workspace, openFile, activePath, switchTo,
  saveStatus, status, manuscripts, onSelectManuscript, onSelectAllManuscripts,
  session, loginEnabled, onLogout, returnTo, action, drawer,
}: HeaderSectionProps) {
  return (
    <AppHeader
      source={source} manuscriptDir={dirName ?? undefined}
      manuscriptName={dirName !== null ? active?.manuscriptNames?.[dirName] : undefined}
      manuscripts={manuscripts} manuscriptId={dirName ?? undefined}
      onSelectManuscript={onSelectManuscript}
      onSelectAllManuscripts={onSelectAllManuscripts}
      onRenameManuscript={createOpenManuscriptRenamer(active, dirName, { workspace, registry: projectRegistry, openFile, activePath, refresh: () => { if (active) switchTo(active.id); } })}
      saveStatus={saveStatus}
      status={status ?? undefined}
      action={action}
      session={session} loginEnabled={loginEnabled} onLogout={onLogout} returnTo={returnTo}
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
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => void;
  drawer: ReturnType<typeof useDrawerState>;
  workspace: WorkspaceAdapter;
  paths: string[];
  activePath: string | null;
  onOpen: (path: string) => void;
}

function DrawerSection({
  projects,
  active,
  switchTo,
  create,
  rename,
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
      onRenameProject={active ? (name) => rename(active.id, name) : undefined}
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

export function App() {
  const {
    workspace, projects, active, loading, error, switchTo, create, rename, remove,
  } = useProjects();
  const { activePath, openFile } = useActiveFile(workspace, active?.id ?? null);
  const paths = useWorkspacePaths(workspace, active);
  const { session, loginEnabled, logout } = useSession();
  const owners = useOwners(session);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const { isDir, contentPath } = resolveContentPath(activePath, paths);
  const file = useActiveFileContent(workspace, contentPath);
  const drawer = useDrawerState();
  const manuscripts = manuscriptOptions(paths, active);
  const draft = useDraftSection({ project: active, workspace, session, owners, deps: createDraftSectionDeps(session) });
  const returnTo = `${window.location.pathname}${window.location.search}`;

  if (loading) return <div>Loading workspace...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!workspace || !activePath) return <div>Empty workspace</div>;
  const dirName = manuscriptDirName(activePath);

  return (
    <div className="flex h-dvh flex-col">
      <HeaderSection
        active={active} source={active?.source} dirName={dirName}
        workspace={workspace} openFile={openFile} activePath={activePath}
        switchTo={switchTo} saveStatus={saveStatus} status={draft.status} manuscripts={manuscripts}
        onSelectManuscript={(id) => { void openFile(`manuscripts/${id}`); }}
        onSelectAllManuscripts={() => { void openFile('manuscripts'); }}
        session={session} loginEnabled={loginEnabled} onLogout={logout}
        returnTo={returnTo} action={draft.action} drawer={drawer}
      />
      <EditorArea
        workspace={workspace} activePath={activePath} isDir={isDir}
        file={file !== null && file.path === contentPath ? file : null}
        projectId={active?.id ?? ''} onSaveStatusChange={setSaveStatus}
        formattingToolbar openFile={openFile}
      />
      <DrawerSection
        projects={projects} active={active} switchTo={switchTo}
        create={create} rename={rename} remove={remove} drawer={drawer}
        workspace={workspace} paths={paths} activePath={activePath} onOpen={openFile}
      />
      {draft.dialogs}
    </div>
  );
}

export default App;
