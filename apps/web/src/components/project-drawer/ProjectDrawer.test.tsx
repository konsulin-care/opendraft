import 'fake-indexeddb/auto';
import { useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { AppHeader } from '../AppHeader';
import { APP_BAR_HEIGHT } from '../app-bar-layout';
import type { AppHeaderProps } from '../AppHeader';
import { ProjectDrawer, useProjectDrawer, DRAWER_OPEN_STORAGE_KEY } from './ProjectDrawer';
import { DeleteProjectAction } from './DeleteProjectDialog';
import { App } from '../../App';
import { projectRegistry } from '../../hooks/useProjects';

// @vitest-environment jsdom

/** Files offered by the stub tree inside the drawer. */
const FILES = ['manuscripts/p/article.qmd', 'manuscripts/p/refs.bib'];

/** Stub tree standing in for FileTree; picks files through the drawer context. */
function FileListStub() {
  const { onFileSelected } = useProjectDrawer();
  return (
    <ul>
      {FILES.map((path) => (
        <li key={path}>
          <button type="button" onClick={onFileSelected}>
            {path}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** App-like shell: header toggle, main region, and the overlay drawer. */
function Harness() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headerProps: AppHeaderProps = {
    fileName: 'article.qmd',
    mode: 'wysiwyg',
    onSelectMode: vi.fn(),
    saveStatus: 'saved',
    formattingToolbar: true,
    onToggleFormattingToolbar: vi.fn(),
    onCommit: vi.fn(),
  };
  return (
    <>
      <AppHeader
        {...headerProps}
        sidebarOpen={open}
        onToggleSidebar={() => setOpen((o) => !o)}
        toggleButtonRef={toggleRef}
      />
      <main data-testid="main" style={{ flex: 1, overflow: 'hidden' }}>
        editor
      </main>
      <ProjectDrawer open={open} onClose={() => setOpen(false)} toggleRef={toggleRef} title="Paper">
        <FileListStub />
      </ProjectDrawer>
    </>
  );
}

/** Set the jsdom viewport width and notify listeners. */
function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

/** Open the drawer via the book button. */
function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: 'OpenDraft' }));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('project drawer toggle', () => {
  it('wires the OpenDraft button with aria-controls and toggles the dialog', () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'OpenDraft' });
    expect(toggle.getAttribute('aria-controls')).toBe('project-drawer');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();

    openDrawer();
    expect(screen.getByRole('dialog', { name: 'Project' })).toBeDefined();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes on Escape and returns focus to the book button', async () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'OpenDraft' });
    openDrawer();
    expect(screen.getByRole('dialog', { name: 'Project' })).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('keeps <main> untouched while the drawer is open', async () => {
    render(<Harness />);
    const main = screen.getByTestId('main');
    const before = {
      class: main.getAttribute('class'),
      style: main.getAttribute('style'),
    };

    openDrawer();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

    expect(main.getAttribute('class')).toBe(before.class);
    expect(main.getAttribute('style')).toBe(before.style);
  });
});

describe('project drawer responsiveness', () => {
  it('closes after selecting a file at 375px', async () => {
    setViewport(375);
    render(<Harness />);
    openDrawer();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

    fireEvent.click(screen.getByText('manuscripts/p/article.qmd'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes after selecting a file at 768px', async () => {
    setViewport(768);
    render(<Harness />);
    openDrawer();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

    fireEvent.click(screen.getByText('manuscripts/p/refs.bib'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('stays open after selecting a file at 1280px', async () => {
    setViewport(1280);
    render(<Harness />);
    openDrawer();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

    fireEvent.click(screen.getByText('manuscripts/p/article.qmd'));
    expect(screen.getByRole('dialog', { name: 'Project' })).toBeDefined();
  });

  it('closes when the backdrop is clicked at 768px', async () => {
    setViewport(768);
    render(<Harness />);
    openDrawer();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());

    fireEvent.click(screen.getByTestId('project-drawer-backdrop'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('project drawer persistence', () => {
  it('writes opendraft:drawer-open only at 1024px and wider', async () => {
    setViewport(375);
    const { unmount } = render(<Harness />);
    openDrawer();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    expect(localStorage.getItem(DRAWER_OPEN_STORAGE_KEY)).toBeNull();
    unmount();

    localStorage.clear();
    setViewport(768);
    const second = render(<Harness />);
    openDrawer();
    await waitFor(() => expect(second.getByRole('dialog')).toBeDefined());
    expect(localStorage.getItem(DRAWER_OPEN_STORAGE_KEY)).toBeNull();
    second.unmount();

    localStorage.clear();
    setViewport(1280);
    render(<Harness />);
    openDrawer();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeDefined());
    expect(localStorage.getItem(DRAWER_OPEN_STORAGE_KEY)).toBe('true');
  });
});

/** Project the footer's delete action removes. */
const DELETE_PROJECT = { id: 'proj-1', name: 'Paper' };

/** Drawer harness carrying the delete footer the app composes in. */
function DeleteFooterHarness({
  onConfirm,
}: {
  /** Stands in for the registry remove action. */
  onConfirm: (id: string) => void;
}) {
  return (
    <ProjectDrawer
      open
      onClose={() => {}}
      title="Paper"
      footer={<DeleteProjectAction project={DELETE_PROJECT} onConfirm={onConfirm} />}
    >
      <FileListStub />
    </ProjectDrawer>
  );
}

describe('project drawer delete footer', () => {
  it('holds a full-width red Delete project button that opens the dialog', () => {
    render(<DeleteFooterHarness onConfirm={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Delete project' });

    expect(button.closest('footer')).not.toBeNull();
    expect(button.className).toContain('w-full');
    expect(button.className).toContain('px-3');
    expect(button.className).toContain('bg-red-600');
    expect(button.className).toContain('text-white');

    fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Delete project' })).toBeDefined();
  });

  it('runs remove only after the matching name is typed', () => {
    const remove = vi.fn<(id: string) => void>();
    render(<DeleteFooterHarness onConfirm={remove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete project' });
    const confirm = within(dialog).getByRole('button', {
      name: 'Delete project',
    }) as HTMLButtonElement;
    const input = within(dialog).getByLabelText('Confirm project name');

    fireEvent.change(input, { target: { value: 'Pape' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(remove).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'Paper' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(DELETE_PROJECT.id);
    expect(screen.queryByRole('dialog', { name: 'Delete project' })).toBeNull();
  });
});

describe('project drawer layout regions', () => {
  it('has an APP_BAR_HEIGHT header, one scroll container around the tree, and a shrink-0 footer outside it', () => {
    setViewport(375);
    render(<DeleteFooterHarness onConfirm={vi.fn()} />);
    const panel = screen.getByTestId('project-drawer');
    const header = panel.querySelector('header') as HTMLElement;
    const footer = panel.querySelector('footer');
    const scrollers = panel.querySelectorAll('.overflow-y-auto');

    expect(panel.className).toContain('flex-col');
    expect(header.className).toContain(APP_BAR_HEIGHT);
    expect(scrollers).toHaveLength(1);
    expect(scrollers[0].contains(screen.getByText(FILES[0]))).toBe(true);
    expect(footer?.className).toContain('shrink-0');
    expect(scrollers[0].contains(footer)).toBe(false);
    expect([panel.children[0], panel.children[2]]).toEqual([header, footer]);
    expect(within(header).getByRole('button', { name: 'Close project drawer' })).toBeDefined();
    expect(header.textContent).toContain('Paper');
  });
});

describe('App drawer wiring', () => {
  beforeEach(async () => {
    localStorage.clear();
    for (const record of await projectRegistry.list()) {
      await projectRegistry.remove(record.id);
    }
  });

  it('opens the project drawer from the app header book button', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('app-header')).toBeDefined(), {
      timeout: 10000,
    });

    const toggle = screen.getByRole('button', { name: 'OpenDraft' });
    expect(toggle.getAttribute('aria-controls')).toBe('project-drawer');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Project' })).toBeDefined(),
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
