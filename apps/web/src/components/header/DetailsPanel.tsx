import type { ReactNode, RefObject } from 'react';
import type { ProjectSource } from '@opendraft/workspace';
import { ChevronDown } from 'lucide-react';
import type { HeaderStatus } from '../../hooks/draft-header-status';
import type { SaveStatus } from '../AppHeader';
import { InlineEditField } from '../InlineEditField';
import { Surface } from '../surface/Surface';
import { RepoSubtitle } from './RepoSubtitle';
import { SAVE_STATE } from './TitleTrigger';
import { repoSubtitle } from './repo-subtitle';

/** Props for {@link DetailsPanel}. */
export interface DetailsPanelProps {
  /** Id of the panel element, referenced by the trigger's aria-controls. */
  id: string;
  /** Called when the scrim or the close button is pressed. */
  onClose: () => void;
  /** Called when the user asks to switch manuscript; hides the switch button when absent. */
  onOpenPicker?: () => void;
  /** Ref forwarded to the switch manuscript button, used to restore focus. */
  switchRef?: RefObject<HTMLButtonElement | null>;
  /** Display name of the manuscript; hides the editable row when absent. */
  name?: string;
  /** Called with the trimmed name when the user renames the manuscript. */
  onRename?: (value: string) => void | Promise<void>;
  /** Source of the active project, used for the location row. */
  source?: ProjectSource;
  /** Current autosave state, shown in the status row. */
  saveStatus: SaveStatus;
  /** Draft status: branch, draft label, notice and pull request URL. */
  status?: HeaderStatus;
}

/** Definition list holding the detail rows, in reading order. */
const LIST_CLASS = 'flex flex-col gap-1.5 px-3 py-2 text-xs text-gray-600 md:pr-10';

/** One detail row: a muted term and its value. */
const ROW_CLASS = 'flex min-w-0 items-baseline gap-2';

/** Term styling shared by every labelled row. */
const TERM_CLASS = 'shrink-0 text-gray-500';

/** Value styling shared by every row. */
const VALUE_CLASS = 'min-w-0 text-gray-900';

/** Select-like wrapper around the editable name and the switch button. */
const SWITCH_ROW_CLASS = 'flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1.5';

/** Trailing chevron button opening the manuscript picker. */
const SWITCH_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black';

/** Props for the internal {@link Row} helper. */
interface RowProps {
  /** Muted row label; omitted for the plain lines. */
  term?: string;
  /** Row content. */
  children: ReactNode;
}

/**
 * One row of the details list: a muted term and its value.
 *
 * @param props - See {@link RowProps}.
 * @returns The row markup.
 */
function Row({ term, children }: RowProps) {
  return (
    <div className={ROW_CLASS}>
      {term !== undefined && <dt className={TERM_CLASS}>{term}</dt>}
      <dd className={VALUE_CLASS}>{children}</dd>
    </div>
  );
}

/** Props for the internal {@link StatusValue} helper. */
interface StatusValueProps {
  /** Save label from the autosave state table. */
  saveLabel: string;
  /** Draft status providing the draft label, notice and suggestion URL. */
  status?: HeaderStatus;
}

/**
 * Value cell of the status row: combined labels, notice and suggestion link.
 *
 * @param props - See {@link StatusValueProps}.
 * @returns The status value markup.
 */
function StatusValue({ saveLabel, status }: StatusValueProps) {
  return (
    <>
      <span className="break-words">
        {saveLabel}
        {status?.draftLabel !== undefined && ` · ${status.draftLabel}`}
      </span>
      {status?.notice ? <span className="block text-gray-700">{status.notice}</span> : null}
      {status?.pullRequestUrl !== undefined && (
        <a
          href={status.pullRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-black underline decoration-dashed underline-offset-2"
        >
          View suggestion
        </a>
      )}
    </>
  );
}

/** Props for the internal {@link ManuscriptRow} helper. */
interface ManuscriptRowProps {
  /** Display name of the manuscript. */
  name: string;
  /** Called with the trimmed name when the user renames the manuscript. */
  onRename?: (value: string) => void | Promise<void>;
  /** Called when the user asks to switch manuscript; hides the switch button when absent. */
  onOpenPicker?: () => void;
  /** Ref forwarded to the switch manuscript button. */
  switchRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Manuscript id row: the editable name, wrapped in a select-like row with a
 * trailing chevron button when a picker handler is given.
 *
 * @param props - See {@link ManuscriptRowProps}.
 * @returns The row markup.
 */
function ManuscriptRow({ name, onRename, onOpenPicker, switchRef }: ManuscriptRowProps) {
  const field = (
    <InlineEditField
      value={name}
      label="Manuscript name"
      testId="manuscript-title"
      onSave={onRename}
      inputClassName={onOpenPicker === undefined ? undefined : 'flex-1'}
    />
  );

  return (
    <Row term="Manuscript ID">
      {onOpenPicker === undefined ? (
        field
      ) : (
        <div className={SWITCH_ROW_CLASS}>
          {field}
          <button
            ref={switchRef}
            type="button"
            aria-label="Switch manuscript"
            title="Switch manuscript"
            aria-haspopup="dialog"
            onClick={onOpenPicker}
            className={SWITCH_BUTTON_CLASS}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </Row>
  );
}

/** Props for the internal {@link DetailsList} helper. */
interface DetailsListProps {
  /** Display name of the manuscript; hides the editable row when absent. */
  name?: string;
  /** Called with the trimmed name when the user renames the manuscript. */
  onRename?: (value: string) => void | Promise<void>;
  /** Called when the user asks to switch manuscript. */
  onOpenPicker?: () => void;
  /** Ref forwarded to the switch manuscript button. */
  switchRef?: RefObject<HTMLButtonElement | null>;
  /** Source of the active project, used for the location row. */
  source?: ProjectSource;
  /** Current autosave state, shown in the status row. */
  saveStatus: SaveStatus;
  /** Draft status: branch, draft label, notice and pull request URL. */
  status?: HeaderStatus;
}

/**
 * Definition list holding every detail row, in reading order.
 *
 * @param props - See {@link DetailsListProps}.
 * @returns The details list markup.
 */
function DetailsList({
  name,
  onRename,
  onOpenPicker,
  switchRef,
  source,
  saveStatus,
  status,
}: DetailsListProps) {
  const location = source === undefined ? { prefix: 'Only on this device' } : repoSubtitle(source);

  return (
    <dl className={LIST_CLASS}>
      {name !== undefined && (
        <ManuscriptRow
          name={name}
          onRename={onRename}
          onOpenPicker={onOpenPicker}
          switchRef={switchRef}
        />
      )}
      <Row>
        <RepoSubtitle {...location} />
      </Row>
      <Row>Changes are saved in this browser</Row>
      {status?.branch !== undefined && <Row term="Local branch">{status.branch}</Row>}
      <Row term="Status">
        <StatusValue saveLabel={SAVE_STATE[saveStatus].label} status={status} />
      </Row>
    </dl>
  );
}

/**
 * Manuscript details disclosure panel.
 *
 * The panel lists, in order, the editable manuscript name, where the project
 * lives, the browser-only save note, the local draft branch of GitHub
 * projects, and the combined save and draft status with an optional suggestion
 * link. Below `md` it is a top sheet above a scrim; from `md` up it is a
 * popover anchored under the title trigger with a close button.
 *
 * @param props - See {@link DetailsPanelProps}.
 * @returns The surface holding the details list.
 */
export function DetailsPanel({
  id,
  onClose,
  onOpenPicker,
  switchRef,
  ...rest
}: DetailsPanelProps) {
  return (
    <Surface
      id={id}
      role="region"
      label="Manuscript details"
      variant="top-sheet"
      mdVariant="popover"
      scrim="below-md"
      closeButton="md"
      closeLabel="Close details"
      onClose={onClose}
    >
      <DetailsList {...rest} onOpenPicker={onOpenPicker} switchRef={switchRef} />
    </Surface>
  );
}
