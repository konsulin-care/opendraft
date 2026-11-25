/**
 * Touch drawer for one cross-reference label. Titles a bottom sheet with
 * the label kind, renders the shared cross-reference details as its body
 * and offers a "Go to <Kind>" action that scrolls the referenced block
 * into view. Broken labels get no action.
 */
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import type { CrossrefKind } from '@opendraft/manuscript';
import { BottomSheet } from '../components/BottomSheet';
import type { BottomSheetAction } from '../components/BottomSheet';
import { CrossrefDetails } from './crossref-tooltip';

/** Display names for each cross-reference kind. */
const KIND_NAMES: Record<CrossrefKind, string> = {
  sec: 'Section',
  fig: 'Figure',
  tbl: 'Table',
  eq: 'Equation',
};

/** Props for {@link CrossrefSheet}. */
export interface CrossrefSheetProps {
  /** The label id, for example `fig-cat`. */
  id: string;
  /** The label kind, used to show the human-readable kind name. */
  kind: CrossrefKind;
  /** The label caption, empty for broken labels. */
  caption?: string;
  /** Whether the label could not be resolved in the manuscript. */
  broken?: boolean;
  /** File holding the referenced block, used by the go-to action. */
  file?: string;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

/**
 * Scroll the block that holds a cross-reference label into view.
 *
 * @param file - The file path stored on the block's `data-block-file`.
 */
function scrollToBlock(file: string | undefined): void {
  if (!file) return;
  const target = document.querySelector<HTMLElement>(
    `[data-block-file="${file}"]`,
  );
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Bottom sheet showing a cross-reference label's kind, id and caption
 * with a go-to action for resolved labels.
 *
 * @param props - See {@link CrossrefSheetProps}.
 * @returns The cross-reference sheet markup.
 */
export function CrossrefSheet({
  id,
  kind,
  caption,
  broken,
  file,
  onClose,
}: CrossrefSheetProps): ReactNode {
  const action: BottomSheetAction | undefined = broken
    ? undefined
    : {
        label: `Go to ${KIND_NAMES[kind]}`,
        onClick: () => {
          scrollToBlock(file);
          onClose();
        },
      };

  return (
    <BottomSheet title={KIND_NAMES[kind]} onClose={onClose} action={action}>
      <CrossrefDetails id={id} kind={kind} caption={caption} broken={broken} />
    </BottomSheet>
  );
}

/** Active cross-reference sheet root, if any. */
let sheetRoot: ReturnType<typeof createRoot> | null = null;
/** Active cross-reference sheet container, if any. */
let sheetContainer: HTMLElement | null = null;

/**
 * Mount the cross-reference sheet into a body container.
 *
 * @param props - The label data and optional close callback.
 */
export function showCrossrefSheet(
  props: Omit<CrossrefSheetProps, 'onClose'> & { onClose?: () => void },
): void {
  hideCrossrefSheet();

  const container = document.createElement('div');
  container.className = 'crossref-sheet-container';
  document.body.appendChild(container);
  sheetContainer = container;

  sheetRoot = createRoot(container);
  sheetRoot.render(
    React.createElement(CrossrefSheet, {
      ...props,
      onClose: () => {
        hideCrossrefSheet();
        props.onClose?.();
      },
    }),
  );
}

/** Unmount the active cross-reference sheet, if any. */
export function hideCrossrefSheet(): void {
  if (sheetRoot) {
    sheetRoot.unmount();
    sheetRoot = null;
  }
  if (sheetContainer) {
    sheetContainer.remove();
    sheetContainer = null;
  }
}
