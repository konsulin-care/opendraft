import type { RefObject } from 'react';
import type { ProjectSource } from '@opendraft/workspace';
import type { HeaderStatus } from '../../hooks/draft-header-status';
import type { SaveStatus } from '../AppHeader';
import { Surface } from '../surface/Surface';
import { DetailList, DetailRow } from './detail-list';
import { ManuscriptDetailRow } from './ManuscriptDetailRow';
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
    <DetailList>
      {name !== undefined && (
        <ManuscriptDetailRow
          name={name}
          onRename={onRename}
          onOpenPicker={onOpenPicker}
          switchRef={switchRef}
        />
      )}
      <DetailRow>
        <RepoSubtitle {...location} />
      </DetailRow>
      <DetailRow>Changes are saved in this browser</DetailRow>
      {status?.branch !== undefined && (
        <DetailRow term="Local branch">{status.branch}</DetailRow>
      )}
      <DetailRow term="Status">
        <StatusValue saveLabel={SAVE_STATE[saveStatus].label} status={status} />
      </DetailRow>
    </DetailList>
  );
}

/**
 * Manuscript details disclosure panel.
 *
 * The panel lists, in order, the manuscript row (editable, with the picker
 * button), where the project lives, the browser-only save note, the local
 * draft branch of GitHub projects, and the combined save and draft status with
 * an optional suggestion link. The rows and the list come from the shared
 * detail primitives, so the reader panel renders the same rhythm. Below `md`
 * it is a top sheet above a scrim; from `md` up it is a popover anchored under
 * the title trigger with a close button.
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
