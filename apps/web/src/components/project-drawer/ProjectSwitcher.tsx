import { useState } from 'react';
import type { ProjectRecord } from '@opendraft/workspace';
import { ChevronDown } from 'lucide-react';
import { NewProjectDialog } from './NewProjectDialog';
import { SwitcherDropdown } from './project-switcher-panels';
import type { SwitcherMode } from './project-switcher-panels';

/** Props for {@link ProjectSwitcher}. */
export interface ProjectSwitcherProps {
  /** Projects to offer; re-sorted by most recently opened before display. */
  projects: ProjectRecord[];
  /** The active project, whose name labels the switcher button. */
  active: ProjectRecord | null;
  /** Make the given project active. */
  switchTo: (id: string) => void;
  /** Rename a project (the id never changes). */
  rename: (id: string, name: string) => void;
  /** Register and scaffold a new project. */
  create: (name: string, manuscriptId: string) => void;
  /** Remove a project. */
  remove: (id: string) => void;
}

/** Sort projects by most recently opened, first. */
function byRecentFirst(projects: ProjectRecord[]): ProjectRecord[] {
  return [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/**
 * Switcher toggle button labelled with the active project's name.
 *
 * @param props - Button label, open state, and toggle handler.
 */
function SwitcherButton({
  label,
  open,
  onToggle,
}: {
  /** Accessible label and visible text; the active project's name. */
  label: string;
  /** Whether the dropdown is open. */
  open: boolean;
  /** Toggle the dropdown. */
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="true"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center gap-1 rounded-md px-3 py-1 text-sm font-medium text-gray-900 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
    >
      <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
    </button>
  );
}

/** State and handlers behind {@link ProjectSwitcher}. */
interface SwitcherState {
  /** Whether the dropdown is open. */
  open: boolean;
  /** Panel shown under the project list. */
  mode: SwitcherMode;
  /** Whether the new-project dialog is open. */
  creating: boolean;
  /** Toggle the dropdown. */
  toggle: () => void;
  /** Choose a project from the dropdown and close it. */
  choose: (id: string) => void;
  /** Enter inline rename mode. */
  setMode: (mode: SwitcherMode) => void;
  /** Rename the active project. */
  commitRename: (name: string) => void;
  /** Leave delete mode, remove the active project, and close the dropdown. */
  confirmDelete: () => void;
  /** Open or close the new-project dialog. */
  setCreating: (creating: boolean) => void;
}

/**
 * Dropdown, panel-mode, and dialog state for the project switcher, wiring
 * the callbacks to the registry actions passed in.
 *
 * @param active - The active project, or null when none.
 * @param switchTo - Make the given project active.
 * @param rename - Rename the active project.
 * @param remove - Remove the active project.
 * @returns See {@link SwitcherState}.
 */
function useSwitcherState(
  active: ProjectRecord | null,
  switchTo: (id: string) => void,
  rename: (id: string, name: string) => void,
  remove: (id: string) => void,
): SwitcherState {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SwitcherMode>('list');
  const [creating, setCreating] = useState(false);

  /** Choose a project from the dropdown and close it. */
  const choose = (id: string) => {
    switchTo(id);
    setOpen(false);
  };

  /** Leave delete mode and close the dropdown. */
  const confirmDelete = () => {
    if (active) remove(active.id);
    setMode('list');
    setOpen(false);
  };

  /** Rename the active project. */
  const commitRename = (name: string) => {
    if (active) rename(active.id, name);
  };

  return {
    open,
    mode,
    creating,
    toggle: () => setOpen((o) => !o),
    choose,
    setMode,
    commitRename,
    confirmDelete,
    setCreating,
  };
}

/**
 * Project switcher for the drawer header: a dropdown of recently opened
 * projects, inline rename, delete behind an exact-name confirmation, and a
 * "+ New project" action opening {@link NewProjectDialog}.
 *
 * @param props - See {@link ProjectSwitcherProps}.
 */
export function ProjectSwitcher({
  projects,
  active,
  switchTo,
  rename,
  create,
  remove,
}: ProjectSwitcherProps) {
  const state = useSwitcherState(active, switchTo, rename, remove);

  return (
    <div className="relative min-w-0">
      <SwitcherButton
        label={active?.name ?? 'Project'}
        open={state.open}
        onToggle={state.toggle}
      />
      {state.open && (
        <SwitcherDropdown
          projects={byRecentFirst(projects)}
          active={active}
          mode={state.mode}
          onSelect={state.choose}
          onCommitRename={state.commitRename}
          onSetMode={state.setMode}
          onConfirmDelete={state.confirmDelete}
          onNew={() => state.setCreating(true)}
        />
      )}
      {state.creating && (
        <NewProjectDialog onCreate={create} onClose={() => state.setCreating(false)} />
      )}
    </div>
  );
}
