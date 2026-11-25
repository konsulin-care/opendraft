import { useState } from 'react';
import type { ProjectRecord } from '@opendraft/workspace';

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
 * Dropdown footer: rename the active project or open the new-project dialog.
 *
 * @param props - Handlers for the rename and new-project actions.
 */
export function ActionsRow({
  onRename,
  onNew,
}: {
  /** Open the rename form for the active project. */
  onRename?: () => void;
  /** Open the new-project dialog. */
  onNew: () => void;
}) {
  return (
    <div className="space-y-1 px-2 py-1">
      {onRename && (
        <button
          type="button"
          onClick={onRename}
          className="w-full rounded-md px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
        >
          Rename project
        </button>
      )}
      <button
        type="button"
        onClick={onNew}
        className="w-full rounded-md bg-black px-3 py-1 text-sm text-white hover:bg-gray-900"
      >
        New project
      </button>
    </div>
  );
}

/** Props for {@link RenameProjectForm}. */
export interface RenameProjectFormProps {
  /** Current project name, pre-filled in the field. */
  name: string;
  /** Commit the trimmed new name. */
  onRename: (name: string) => void;
  /** Close the form without renaming. */
  onCancel: () => void;
}

/**
 * Small inline form for renaming the active project.
 *
 * @param props - See {@link RenameProjectFormProps}.
 */
export function RenameProjectForm({ name, onRename, onCancel }: RenameProjectFormProps) {
  const [draft, setDraft] = useState(name);

  /** Save the trimmed name when it is non-empty and changed. */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed === '' || trimmed === name) {
      onCancel();
      return;
    }
    onRename(trimmed);
  };

  return (
    <form onSubmit={submit} className="space-y-1 px-2 pb-2">
      <label className="block text-xs text-gray-600">
        Project name
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          autoFocus
          aria-label="Project name"
          className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
        />
      </label>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-black px-2 py-1 text-sm text-white hover:bg-gray-900"
        >
          Save
        </button>
      </div>
    </form>
  );
}

/** Props for {@link SwitcherDropdown}. */
export interface SwitcherDropdownProps {
  /** Projects sorted by most recently opened first. */
  projects: ProjectRecord[];
  /** The active project, or null when none. */
  active: ProjectRecord | null;
  /** Choose a project from the list. */
  onSelect: (id: string) => void;
  /** Open the new-project dialog. */
  onNew: () => void;
  /** Rename the active project, when renaming is available. */
  onRenameProject?: (name: string) => void | Promise<void>;
}

/**
 * Open switcher dropdown: the project list plus, for the active project,
 * the rename and new-project actions.
 *
 * The panel is absolutely positioned under the trigger at its width, so it
 * overlays the file tree instead of pushing it down.
 *
 * @param props - See {@link SwitcherDropdownProps}.
 */
export function SwitcherDropdown({
  projects,
  active,
  onSelect,
  onNew,
  onRenameProject,
}: SwitcherDropdownProps) {
  const [renaming, setRenaming] = useState(false);

  /** Commit the rename and close the form. */
  const rename = (name: string) => {
    void onRenameProject?.(name);
    setRenaming(false);
  };

  return (
    <div className="absolute left-0 right-0 top-full z-10 mx-3 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
      <ProjectList projects={projects} activeId={active?.id} onSelect={onSelect} />
      {active && (
        <div className="border-t border-gray-100 py-1">
          {renaming ? (
            <RenameProjectForm
              name={active.name}
              onRename={rename}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <ActionsRow
              onRename={onRenameProject ? () => setRenaming(true) : undefined}
              onNew={onNew}
            />
          )}
        </div>
      )}
    </div>
  );
}
