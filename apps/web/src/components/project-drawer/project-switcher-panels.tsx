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
 * Dropdown footer: the panel's only action, opening the new-project dialog.
 *
 * @param props - Handler for the new-project action.
 */
export function ActionsRow({
  onNew,
}: {
  /** Open the new-project dialog. */
  onNew: () => void;
}) {
  return (
    <div className="px-2 py-1">
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
}

/**
 * Open switcher dropdown: the project list plus, for the active project,
 * the new-project action as the panel's only button.
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
}: SwitcherDropdownProps) {
  return (
    <div className="absolute left-0 right-0 top-full z-10 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
      <ProjectList projects={projects} activeId={active?.id} onSelect={onSelect} />
      {active && (
        <div className="border-t border-gray-100 py-1">
          <ActionsRow onNew={onNew} />
        </div>
      )}
    </div>
  );
}
