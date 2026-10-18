import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { X } from 'lucide-react';

/** DOM id of the drawer panel; referenced by the header toggle's aria-controls. */
export const PROJECT_DRAWER_ID = 'project-drawer';

/** localStorage key persisting the drawer open state (wide viewports only). */
export const DRAWER_OPEN_STORAGE_KEY = 'opendraft:drawer-open';

/** Viewport width (px) at and above which the drawer persists its open state. */
const PERSIST_MIN_WIDTH = 1024;

/** Viewport width (px) at and above which a backdrop is shown behind the drawer. */
const BACKDROP_MIN_WIDTH = 640;

/** Actions the drawer exposes to its children (e.g. the file tree). */
export interface ProjectDrawerContextValue {
  /**
   * Notify the drawer that a file was selected. The drawer closes itself
   * below 1024px and stays open at 1024px and wider.
   */
  onFileSelected: () => void;
}

const NOOP_CONTEXT: ProjectDrawerContextValue = { onFileSelected: () => {} };

const ProjectDrawerContext = createContext<ProjectDrawerContextValue>(NOOP_CONTEXT);

/**
 * Access the enclosing project drawer's actions. Outside a drawer a no-op
 * handler is returned so components like the file tree render standalone.
 *
 * @returns See {@link ProjectDrawerContextValue}.
 */
export function useProjectDrawer(): ProjectDrawerContextValue {
  return useContext(ProjectDrawerContext);
}

/**
 * Read the persisted drawer open state. The state is only ever written for
 * viewports 1024px and wider, so this is meaningful there.
 *
 * @returns True when the drawer was open when last persisted.
 */
export function readDrawerOpenState(): boolean {
  return localStorage.getItem(DRAWER_OPEN_STORAGE_KEY) === 'true';
}

/** Drawer open state exposed to the app shell. */
export interface DrawerState {
  /** Whether the drawer is currently open. */
  open: boolean;
  /** Toggle the drawer. */
  toggle: () => void;
  /** Close the drawer. */
  close: () => void;
  /** Ref of the book button that regains focus on close. */
  toggleRef: RefObject<HTMLButtonElement | null>;
}

/**
 * Drawer open state for the app shell: initialises from the persisted value
 * and exposes toggle/close handlers plus the book-button ref used to return
 * focus on close.
 *
 * @returns The drawer open state and its wiring.
 */
export function useDrawerState(): DrawerState {
  const [open, setOpen] = useState(readDrawerOpenState);
  const toggleRef = useRef<HTMLButtonElement>(null);
  return {
    open,
    toggle: () => setOpen((o) => !o),
    close: () => setOpen(false),
    toggleRef,
  };
}

/**
 * Track the viewport width, updating on resize.
 *
 * @returns The current window width in pixels.
 */
function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

/**
 * Move focus into the drawer when it opens; closing (e.g. via Escape)
 * returns focus to the toggle button.
 *
 * @param open - Whether the drawer is visible.
 * @param panelRef - Ref to the drawer panel element.
 * @param toggleRef - Ref to the toggle button that regains focus.
 */
function useDrawerFocus(
  open: boolean,
  panelRef: RefObject<HTMLDivElement | null>,
  toggleRef?: RefObject<HTMLElement | null>,
): void {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      toggleRef?.current?.focus();
    }
  }, [open, panelRef, toggleRef]);
}

/**
 * Close the drawer when Escape is pressed, from anywhere on the page.
 *
 * @param open - Whether the drawer is visible.
 * @param onClose - Close handler invoked on Escape.
 */
function useEscapeClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);
}

/**
 * Persist the open state, but only at viewports 1024px and wider.
 *
 * @param open - Whether the drawer is visible.
 * @param width - Current viewport width in pixels.
 */
function usePersistedOpenState(open: boolean, width: number): void {
  useEffect(() => {
    if (width < PERSIST_MIN_WIDTH) return;
    localStorage.setItem(DRAWER_OPEN_STORAGE_KEY, JSON.stringify(open));
  }, [open, width]);
}

/** Props for {@link ProjectDrawer}. */
export interface ProjectDrawerProps {
  /** Whether the drawer is visible. */
  open: boolean;
  /** Close the drawer; focus returns to the toggle button. */
  onClose: () => void;
  /** Toggle button that regains focus when the drawer closes. */
  toggleRef?: RefObject<HTMLElement | null>;
  /** Project name shown in the pinned drawer header. */
  title?: string;
  /** Custom pinned-header content (e.g. {@link ProjectSwitcher}); replaces the title. */
  header?: ReactNode;
  /** Drawer body, typically the file tree; only this region scrolls. */
  children?: ReactNode;
}

/** Dimmed backdrop behind the drawer at 640px and wider. */
function DrawerBackdrop({
  dimmed,
  onClose,
}: {
  /** Whether the backdrop is the darker variant used below 1024px. */
  dimmed: boolean;
  /** Close handler invoked on click. */
  onClose: () => void;
}) {
  return (
    <div
      data-testid="project-drawer-backdrop"
      aria-hidden="true"
      onClick={onClose}
      className={`fixed inset-0 z-30 ${dimmed ? 'bg-black/30' : 'bg-black/10'}`}
    />
  );
}

/** Drawer panel: pinned header (with close button below 640px) and scrollable body. */
function DrawerPanel({
  compact,
  panelRef,
  title,
  header,
  onClose,
  children,
}: {
  compact: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  title?: string;
  header?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      id={PROJECT_DRAWER_ID}
      role="dialog"
      aria-label="Project"
      ref={panelRef}
      tabIndex={-1}
      data-testid="project-drawer"
      className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-white shadow-xl outline-none transition-transform motion-reduce:transition-none ${
        compact ? 'w-full' : 'w-80 max-w-full'
      }`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        {header ?? (
          <span className="min-w-0 truncate text-sm font-medium text-gray-900">
            {title ?? 'Project'}
          </span>
        )}
        {compact && (
          <button
            type="button"
            aria-label="Close project drawer"
            onClick={onClose}
            className="inline-flex shrink-0 items-center justify-center rounded-md p-2 text-gray-600 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/**
 * Overlay project drawer. It is always an overlay (never reflows the
 * editor): below 640px it is a full-width sheet with a close button, from
 * 640px it sits beside a dimmed backdrop, and from 1024px it stays open
 * after a file is selected while persisting its open state.
 *
 * @param props - See {@link ProjectDrawerProps}.
 */
export function ProjectDrawer({
  open,
  onClose,
  toggleRef,
  title,
  header,
  children,
}: ProjectDrawerProps) {
  const width = useViewportWidth();
  const panelRef = useRef<HTMLDivElement>(null);
  useDrawerFocus(open, panelRef, toggleRef);
  useEscapeClose(open, onClose);
  usePersistedOpenState(open, width);

  const context = useMemo<ProjectDrawerContextValue>(
    () => ({
      onFileSelected: () => {
        if (width < PERSIST_MIN_WIDTH) onClose();
      },
    }),
    [width, onClose],
  );

  if (!open) return null;

  const compact = width < BACKDROP_MIN_WIDTH;

  return (
    <ProjectDrawerContext.Provider value={context}>
      {width >= BACKDROP_MIN_WIDTH && <DrawerBackdrop dimmed={compact} onClose={onClose} />}
      <DrawerPanel compact={compact} panelRef={panelRef} title={title} header={header} onClose={onClose}>
        {children}
      </DrawerPanel>
    </ProjectDrawerContext.Provider>
  );
}
