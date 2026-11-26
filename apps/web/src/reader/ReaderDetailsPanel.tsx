/**
 * Details panel of the reader header.
 *
 * Below md the reader header collapses into a title trigger; this panel is
 * what that trigger opens. It lists where the repository is published, shows
 * the current manuscript read-only (switching goes through the same picker the
 * editor uses), and keeps the manuscript selection reachable on a phone, where
 * the inline switcher is hidden.
 */

import { useState } from 'react';
import { ManuscriptDetailRow } from '../components/header/ManuscriptDetailRow';
import { ManuscriptPicker } from '../components/header/ManuscriptPicker';
import type { ManuscriptSwitcherOption } from '../components/header/ManuscriptSwitcher';
import { RepoSubtitle } from '../components/header/RepoSubtitle';
import { DetailList, DetailRow } from '../components/header/detail-list';
import { Surface } from '../components/surface/Surface';

/** Props for {@link ReaderDetailsPanel}. */
export interface ReaderDetailsPanelProps {
  /** Id of the panel element, referenced by the trigger's aria-controls. */
  id: string;
  /** Called when the scrim, the close button or a dismissal fires. */
  onClose: () => void;
  /** Published repository slug (`owner/repo`), or an empty string when local. */
  repo: string;
  /** Manuscripts offered by the picker. */
  manuscripts: readonly ManuscriptSwitcherOption[];
  /** Id of the manuscript currently open. */
  selectedId?: string;
  /** Called with the id of the manuscript chosen in the picker. */
  onSelect: (id: string) => void;
  /** When given, adds an "All manuscripts" entry to the picker. */
  onSelectAll?: () => void;
}

/** Heading used when no manuscript is selected. */
const ALL_MANUSCRIPTS = 'All manuscripts';

/**
 * Resolve the title of the selected manuscript.
 *
 * @param manuscripts - Manuscripts offered by the picker.
 * @param selectedId - Id of the manuscript currently open.
 * @returns Its display title, falling back to the id and then to all manuscripts.
 */
function selectedTitle(
  manuscripts: readonly ManuscriptSwitcherOption[],
  selectedId: string | undefined,
): string {
  if (selectedId === undefined) return ALL_MANUSCRIPTS;
  return manuscripts.find((manuscript) => manuscript.id === selectedId)?.title ?? selectedId;
}

/** Delete the repository row: the published location of the manuscript. */
function PublishedRow({ repo }: { repo: string }) {
  return (
    <DetailRow term="Repository">
      {repo === '' ? (
        <RepoSubtitle prefix="Published at" />
      ) : (
        <RepoSubtitle prefix="Published at" repo={repo} href={`https://github.com/${repo}`} />
      )}
    </DetailRow>
  );
}

/**
 * Render the reader's manuscript details surface and its picker.
 *
 * @param props - See {@link ReaderDetailsPanelProps}.
 * @returns The panel surface plus the picker when it is open.
 */
export function ReaderDetailsPanel({
  id,
  onClose,
  repo,
  manuscripts,
  selectedId,
  onSelect,
  onSelectAll,
}: ReaderDetailsPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <Surface
        id={id}
        role="region"
        label="Published details"
        variant="top-sheet"
        mdVariant="popover"
        scrim="below-md"
        closeButton="md"
        closeLabel="Close details"
        onClose={onClose}
      >
        <DetailList>
          <PublishedRow repo={repo} />
          <ManuscriptDetailRow
            name={selectedTitle(manuscripts, selectedId)}
            onOpenPicker={() => setPickerOpen(true)}
          />
        </DetailList>
      </Surface>
      {pickerOpen && (
        <ManuscriptPicker
          manuscripts={manuscripts}
          currentId={selectedId}
          onPick={(picked) => {
            setPickerOpen(false);
            onSelect(picked);
          }}
          onClose={() => setPickerOpen(false)}
          onSelectAll={onSelectAll}
        />
      )}
    </>
  );
}

export default ReaderDetailsPanel;
