import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import type { ProjectRecord } from '@opendraft/workspace';
import { ProjectSwitcher } from './ProjectSwitcher';
import type { ProjectSwitcherProps } from './ProjectSwitcher';
import { AppHeader } from '../AppHeader';
import type { AppHeaderProps } from '../AppHeader';

// @vitest-environment jsdom

/** Id of the project that starts out active (most recently opened). */
const NEWER_ID = 'id-newer';

/** Id of the older project offered in the dropdown. */
const OLDER_ID = 'id-older';

/** Build a local-source project record for the harness. */
function makeRecord(id: string, name: string, lastOpenedAt: number): ProjectRecord {
  return { id, name, source: { kind: 'local' }, createdAt: 0, lastOpenedAt };
}

/** Harness holding projects in state; spies come from `overrides`. */
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

/** Mock ResizeObserver recorded per test so re-measures can be triggered. */
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();

  /** Record the instance and keep the resize callback. */
  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instances.push(this);
  }

  /** Fire the stored callback to simulate a resize notification. */
  trigger(): void {
    this.callback([], this as unknown as ResizeObserver);
  }
}

/** Stub the scrollWidth/clientWidth metrics of an element. */
function stubOverflow(
  element: HTMLElement,
  scrollWidth: number,
  clientWidth: number,
): void {
  Object.defineProperty(element, 'scrollWidth', {
    value: scrollWidth,
    configurable: true,
  });
  Object.defineProperty(element, 'clientWidth', {
    value: clientWidth,
    configurable: true,
  });
}

/** Re-measure the tracked name by firing the hook's ResizeObserver. */
function actResize(): void {
  const instance = MockResizeObserver.instances.at(-1);
  if (!instance) throw new Error('ResizeObserver was not constructed');
  act(() => instance.trigger());
}

beforeEach(() => {
  vi.clearAllMocks();
  MockResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
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

describe('project switcher marquee', () => {
  it('scrolls the name only while the trigger is hovered or focused and it overflows', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Newer Paper' });
    const nameSpan = trigger.querySelector('span') as HTMLElement;
    stubOverflow(nameSpan, 300, 120);
    actResize();

    expect(nameSpan.className).not.toContain('marquee');

    fireEvent.mouseOver(trigger);
    expect(nameSpan.className).toContain('marquee');
    fireEvent.mouseOut(trigger);
    expect(nameSpan.className).not.toContain('marquee');

    fireEvent.focus(trigger);
    expect(nameSpan.className).toContain('marquee');
    fireEvent.blur(trigger);
    expect(nameSpan.className).not.toContain('marquee');
  });

  it('does not scroll a name that fits, even while hovered', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Newer Paper' });
    const nameSpan = trigger.querySelector('span') as HTMLElement;
    stubOverflow(nameSpan, 100, 200);
    actResize();

    fireEvent.mouseOver(trigger);
    expect(nameSpan.className).not.toContain('marquee');
  });
});

describe('project switcher panel positioning', () => {
  it('is absolutely positioned under the trigger at its width, overlaying the tree', () => {
    render(<Harness />);
    openDropdown();

    const panel = screen
      .getByRole('list', { name: 'Projects' })
      .parentElement as HTMLElement;
    expect(panel.className).toContain('absolute');
    expect(panel.className).toContain('top-full');
    expect(panel.className).toContain('w-full');
  });
});

/** Render the app header that now owns the inline project rename (B7). */
function renderHeader(overrides: Partial<AppHeaderProps> = {}) {
  render(
    <AppHeader fileName="manuscript.md" projectName="Newer Paper" mode="wysiwyg"
      onSelectMode={vi.fn()} saveStatus="saved" formattingToolbar
      onToggleFormattingToolbar={vi.fn()} onCommit={vi.fn()} {...overrides} />,
  );
}

describe('project switcher rename', () => {
  it('offers no Rename action in the dropdown', () => {
    render(<Harness />);
    openDropdown();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
  });

  // Rename moved out of the dropdown into the header inline input.
  it('renames through the header input with the trimmed name on Enter and blur', () => {
    const onRename = vi.fn();
    renderHeader({ onRename });
    const input = screen.getByRole('textbox', { name: 'Project name' });
    fireEvent.change(input, { target: { value: '  Renamed Paper  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Renamed Paper');

    fireEvent.change(input, { target: { value: 'Blurred Name' } });
    fireEvent.blur(input);
    expect(onRename).toHaveBeenCalledWith('Blurred Name');
  });

  it('restores the previous name on Escape or an empty entry, without renaming', () => {
    const onRename = vi.fn();
    renderHeader({ onRename });
    const input = screen.getByRole('textbox', { name: 'Project name' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Typo' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('Newer Paper');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).not.toHaveBeenCalled();
    expect(input.value).toBe('Newer Paper');
  });
});

describe('project switcher new project dialog', () => {
  it('pre-fills the manuscript id, gates Create on validity, and creates', () => {
    const create = vi.fn<(name: string, manuscriptId: string) => void>();
    render(<Harness create={create} />);
    openDropdown();

    fireEvent.click(screen.getByRole('button', { name: 'New project' }));
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

describe('project switcher new project action', () => {
  it('offers New project as the panel’s only action, full width and black', () => {
    render(<Harness />);
    openDropdown();

    // The panel's only button outside the project list is New project.
    const list = screen.getByRole('list', { name: 'Projects' });
    const panel = list.parentElement as HTMLElement;
    const outsideList = within(panel)
      .getAllByRole('button')
      .filter((button) => !list.contains(button));
    expect(outsideList.map((button) => button.textContent)).toEqual(['New project']);

    const newProject = screen.getByRole('button', { name: 'New project' });
    expect(newProject.className).toContain('w-full');
    expect(newProject.className).toContain('px-3');
    expect(newProject.className).toContain('bg-black');
    expect(newProject.className).toContain('text-white');
  });
});
