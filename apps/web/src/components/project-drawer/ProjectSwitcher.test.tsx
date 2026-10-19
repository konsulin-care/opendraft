import { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { ProjectRecord } from '@opendraft/workspace';
import { ProjectSwitcher } from './ProjectSwitcher';
import type { ProjectSwitcherProps } from './ProjectSwitcher';

// @vitest-environment jsdom

/** Id of the project that starts out active (most recently opened). */
const NEWER_ID = 'id-newer';

/** Id of the older project offered in the dropdown. */
const OLDER_ID = 'id-older';

/**
 * Build a project record for the harness.
 *
 * @param id - Stable project id.
 * @param name - Display name.
 * @param lastOpenedAt - Last-opened time driving list order.
 * @returns A local-source project record.
 */
function makeRecord(id: string, name: string, lastOpenedAt: number): ProjectRecord {
  return { id, name, source: { kind: 'local' }, createdAt: 0, lastOpenedAt };
}

/**
 * Harness holding projects in state so rename/switch/remove reflect in the
 * rendered names, with optional spies asserted by the tests.
 *
 * @param overrides - Spy handlers recorded before the state updates.
 */
function Harness(overrides: Partial<ProjectSwitcherProps> = {}) {
  // Passed deliberately unsorted: the switcher must sort by lastOpenedAt.
  const [projects, setProjects] = useState<ProjectRecord[]>([
    makeRecord(OLDER_ID, 'Older Paper', 100),
    makeRecord(NEWER_ID, 'Newer Paper', 200),
  ]);
  const [activeId, setActiveId] = useState(NEWER_ID);
  const active = projects.find((p) => p.id === activeId) ?? null;
  return (
    <ProjectSwitcher
      projects={projects}
      active={active}
      switchTo={(id) => {
        overrides.switchTo?.(id);
        setActiveId(id);
      }}
      rename={(id, name) => {
        overrides.rename?.(id, name);
        setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)));
      }}
      create={(name, manuscriptId) => overrides.create?.(name, manuscriptId)}
      remove={(id) => {
        overrides.remove?.(id);
        setProjects((ps) => ps.filter((p) => p.id !== id));
      }}
    />
  );
}

/** Open the project dropdown via the switcher button. */
function openDropdown() {
  fireEvent.click(screen.getByRole('button', { name: 'Newer Paper' }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('project switcher dropdown', () => {
  it('lists projects in lastOpenedAt order and switches on selection', () => {
    const switchTo = vi.fn<(id: string) => void>();
    render(<Harness switchTo={switchTo} />);
    openDropdown();

    const items = within(screen.getByRole('list', { name: 'Projects' })).getAllByRole('button');
    expect(items.map((b) => b.textContent)).toEqual(['Newer Paper', 'Older Paper']);

    fireEvent.click(items[1]);
    expect(switchTo).toHaveBeenCalledWith(OLDER_ID);
    expect(screen.getByRole('button', { name: 'Older Paper' })).toBeDefined();
  });
});

describe('project switcher trigger', () => {
  it('shows the chevron before a truncated name with the full name as title', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Newer Paper' });

    // The chevron element must precede the name in the DOM.
    const children = Array.from(trigger.children);
    expect(children[0]?.tagName.toLowerCase()).toBe('svg');
    const nameSpan = trigger.querySelector('span');
    expect(children[1]).toBe(nameSpan);

    expect(nameSpan?.className).toContain('truncate');
    expect(nameSpan?.getAttribute('title')).toBe('Newer Paper');
    expect(trigger.className).toContain('px-3');
    expect(trigger.className).toContain('w-full');
  });
});

describe('project switcher rename', () => {
  it('renames inline and displays the new name', () => {
    const rename = vi.fn<(id: string, name: string) => void>();
    render(<Harness rename={rename} />);
    openDropdown();

    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Project name'), {
      target: { value: 'Renamed Paper' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(rename).toHaveBeenCalledWith(NEWER_ID, 'Renamed Paper');
    const shown = screen.getAllByRole('button', { name: 'Renamed Paper' });
    expect(shown.length).toBeGreaterThan(0);
  });
});

describe('project switcher new project dialog', () => {
  it('pre-fills the manuscript id, gates Create on validity, and creates', () => {
    const create = vi.fn<(name: string, manuscriptId: string) => void>();
    render(<Harness create={create} />);
    openDropdown();

    fireEvent.click(screen.getByRole('button', { name: '+ New project' }));
    const nameInput = screen.getByLabelText('Project name') as HTMLInputElement;
    const idInput = screen.getByLabelText('Manuscript id') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'My Paper' } });
    expect(idInput.value).toBe('my-paper');

    fireEvent.change(idInput, { target: { value: 'My_Paper' } });
    const createButton = screen.getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    fireEvent.change(idInput, { target: { value: 'my-paper' } });
    expect(createButton.disabled).toBe(false);
    fireEvent.click(createButton);
    expect(create).toHaveBeenCalledWith('My Paper', 'my-paper');
  });
});

describe('project switcher delete', () => {
  it('requires the exact project name before removing', () => {
    const remove = vi.fn<(id: string) => void>();
    render(<Harness remove={remove} />);
    openDropdown();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('button', { name: 'Delete project' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    const input = screen.getByLabelText('Confirm project name');
    fireEvent.change(input, { target: { value: 'Newer Pape' } });
    expect(confirm.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'Newer Paper' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(remove).toHaveBeenCalledWith(NEWER_ID);
  });
});
