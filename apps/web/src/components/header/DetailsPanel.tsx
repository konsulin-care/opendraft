import type { ReactNode } from 'react';
import type { ProjectSource } from '@opendraft/workspace';
import type { HeaderStatus } from '../../hooks/draft-header-status';
import type { SaveStatus } from '../AppHeader';
import { InlineEditField } from '../InlineEditField';
import { RepoSubtitle } from './RepoSubtitle';
import { SAVE_STATE } from './TitleTrigger';
import { repoSubtitle } from './repo-subtitle';

/** Props for {@link DetailsPanel}. */
export interface DetailsPanelProps {
  /** Id of the panel element, referenced by the trigger's aria-controls. */
  id: string;
  /** Called when the scrim is pressed. */
  onClose: () => void;
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

/** Panel surface: full width under the header below `md`, anchored card above. */
const PANEL_CLASS =
  'absolute inset-x-0 top-full z-30 border-b border-gray-200 bg-white shadow-md md:left-14 md:right-auto md:w-80 md:rounded-md md:border';

/** Slide-down entrance animation, disabled while reduced motion is requested. */
const PANEL_ANIMATION =
  'transition duration-150 starting:-translate-y-2 starting:opacity-0 motion-reduce:transition-none';

/** Scrim covering the page below the header while the panel is open on mobile. */
const SCRIM_CLASS = 'fixed inset-x-0 bottom-0 top-14 z-20 bg-black/20 md:hidden';

/** Definition list holding the detail rows, in reading order. */
const LIST_CLASS = 'flex flex-col gap-1.5 px-3 py-2 text-xs text-gray-600';

/** One detail row: a muted term and its value. */
const ROW_CLASS = 'flex min-w-0 items-baseline gap-2';

/** Term styling shared by every labelled row. */
const TERM_CLASS = 'shrink-0 text-gray-500';

/** Value styling shared by every row. */
const VALUE_CLASS = 'min-w-0 text-gray-900';

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

/** Props for the internal {@link DetailsList} helper. */
interface DetailsListProps {
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

/**
 * Definition list holding every detail row, in reading order.
 *
 * @param props - See {@link DetailsListProps}.
 * @returns The details list markup.
 */
function DetailsList({ name, onRename, source, saveStatus, status }: DetailsListProps) {
  const location = source === undefined ? { prefix: 'Only on this device' } : repoSubtitle(source);

  return (
    <dl className={LIST_CLASS}>
      {name !== undefined && (
        <Row term="Manuscript ID">
          <InlineEditField
            value={name}
            label="Manuscript name"
            testId="manuscript-title"
            onSave={onRename}
          />
        </Row>
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
 * link. Below `md` it spans the header width above a scrim that closes it;
 * from `md` up it is a card anchored under the title trigger.
 *
 * @param props - See {@link DetailsPanelProps}.
 * @returns The scrim and the details panel.
 */
export function DetailsPanel({ id, onClose, ...rest }: DetailsPanelProps) {
  return (
    <>
      <div className={SCRIM_CLASS}>
        <button
          type="button"
          aria-label="Close details"
          tabIndex={-1}
          onClick={onClose}
          className="h-full w-full cursor-default"
        />
      </div>
      <div
        id={id}
        role="region"
        aria-label="Manuscript details"
        className={`${PANEL_CLASS} ${PANEL_ANIMATION}`}
      >
        <DetailsList {...rest} />
      </div>
    </>
  );
}
