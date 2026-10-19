import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ProjectRecord } from '@opendraft/workspace';

/** Panel shown under the project list in the switcher dropdown. */
export type SwitcherMode = 'list' | 'rename' | 'delete';

/**
 * Dropdown list of projects, most recently opened first.
 *
 * @param props - Projects to list, active id, and selection handler.
 */
export function ProjectList({
  projects,
  activeId,
  onSelect,
}: {
  /** Projects, already sorted for display. */
  projects: ProjectRecord[];
  /** Id of the active project, highlighted in the list. */
  activeId: string | undefined;
  /** Select a project by id. */
  onSelect: (id: string) => void;
}) {
  return (
    <ul aria-label="Projects" className="max-h-48 overflow-y-auto py-1">
      {projects.map((project) => (
        <li key={project.id}>
          <button
            type="button"
            onClick={() => onSelect(project.id)}
            className={`block w-full truncate px-2 py-1 text-left text-sm hover:bg-gray-50 ${
              project.id === activeId ? 'font-medium text-blue-700' : 'text-gray-700'
            }`}
          >
            {project.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Inline rename panel: a text input pre-filled with the current name plus a
 * save button; Enter also saves. Empty or unchanged names save nothing.
 *
 * @param props - Current name, commit handler, and cancel handler.
 */
export function RenamePanel({
  currentName,
  onCommit,
  onCancel,
}: {
  /** Name shown in the input initially. */
  currentName: string;
  /** Receive the new name. */
  onCommit: (name: string) => void;
  /** Leave rename mode without changing anything. */
  onCancel: () => void;
}) {
  const [value, setValue] = useState(currentName);
  const trimmed = value.trim();
  const save = () => {
    if (trimmed !== '' && trimmed !== currentName) onCommit(trimmed);
    onCancel();
  };
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <input
        type="text"
        aria-label="Project name"
        value={value}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') save();
          if (event.key === 'Escape') onCancel();
        }}
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
      />
      <button
        type="button"
        onClick={save}
        className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
      >
        Save
      </button>
    </div>
  );
}

/**
 * Delete confirmation panel. The confirm button stays disabled until the
 * exact project name is typed.
 *
 * @param props - Project to delete, confirm handler, and cancel handler.
 */
export function DeletePanel({
  project,
  onConfirm,
  onCancel,
}: {
  /** Project being deleted; its exact name unlocks the confirm button. */
  project: ProjectRecord;
  /** Remove the project. */
  onConfirm: () => void;
  /** Leave delete mode without removing anything. */
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="px-2 py-1">
      <p className="mb-1 text-xs text-gray-600">
        Type “{project.name}” to confirm deletion.
      </p>
      <div className="flex items-center gap-1">
        <input
          type="text"
          aria-label="Confirm project name"
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
        />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={value !== project.name}
          className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Delete project
        </button>
      </div>
    </div>
  );
}

/**
 * Action row under the project list: rename, delete, and new project.
 *
 * @param props - Handlers for each action.
 */
export function ActionsRow({
  onRename,
  onDelete,
  onNew,
}: {
  /** Enter inline rename mode. */
  onRename: () => void;
  /** Enter delete confirmation mode. */
  onDelete: () => void;
  /** Open the new-project dialog. */
  onNew: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-1">
      <button
        type="button"
        onClick={onRename}
        className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Rename
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
      >
        Delete
      </button>
      <button
        type="button"
        onClick={onNew}
        className="ml-auto rounded-md px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
      >
        + New project
      </button>
    </div>
  );
}

/** Props for {@link SwitcherDropdown}. */
export interface SwitcherDropdownProps {
  /** Projects sorted by most recently opened first. */
  projects: ProjectRecord[];
  /** The active project, or null when none. */
  active: ProjectRecord | null;
  /** Which panel to show under the list. */
  mode: SwitcherMode;
  /** Choose a project from the list. */
  onSelect: (id: string) => void;
  /** Rename the active project. */
  onCommitRename: (name: string) => void;
  /** Switch to the given panel mode. */
  onSetMode: (mode: SwitcherMode) => void;
  /** Remove the active project. */
  onConfirmDelete: () => void;
  /** Open the new-project dialog. */
  onNew: () => void;
}

/**
 * Panel shown for the active project: inline rename, delete confirmation,
 * or the action row. Renders nothing when there is no active project.
 *
 * @param props - Active project, panel mode, and the panel handlers.
 */
function ActivePanel({
  active,
  mode,
  onCommitRename,
  onSetMode,
  onConfirmDelete,
  onNew,
}: Pick<
  SwitcherDropdownProps,
  'active' | 'mode' | 'onCommitRename' | 'onSetMode' | 'onConfirmDelete' | 'onNew'
>) {
  if (!active) return null;
  const cancel = () => onSetMode('list');
  const wrap = (panel: ReactNode) => (
    <div className="border-t border-gray-100 py-1">{panel}</div>
  );
  if (mode === 'rename') {
    return wrap(<RenamePanel currentName={active.name} onCommit={onCommitRename} onCancel={cancel} />);
  }
  if (mode === 'delete') {
    return wrap(<DeletePanel project={active} onConfirm={onConfirmDelete} onCancel={cancel} />);
  }
  return wrap(
    <ActionsRow
      onRename={() => onSetMode('rename')}
      onDelete={() => onSetMode('delete')}
      onNew={onNew}
    />,
  );
}

/**
 * Open switcher dropdown: the project list plus, for the active project,
 * the rename panel, delete confirmation, or action row.
 *
 * The panel is absolutely positioned under the trigger at its width, so it
 * overlays the file tree instead of pushing it down.
 *
 * @param props - See {@link SwitcherDropdownProps}.
 */
export function SwitcherDropdown({
  projects,
  active,
  mode,
  onSelect,
  onCommitRename,
  onSetMode,
  onConfirmDelete,
  onNew,
}: SwitcherDropdownProps) {
  return (
    <div className="absolute left-0 right-0 top-full z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
      <ProjectList projects={projects} activeId={active?.id} onSelect={onSelect} />
      <ActivePanel
        active={active}
        mode={mode}
        onCommitRename={onCommitRename}
        onSetMode={onSetMode}
        onConfirmDelete={onConfirmDelete}
        onNew={onNew}
      />
    </div>
  );
}
