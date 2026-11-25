/**
 * Touch drawer for one citation reference. Titles a bottom sheet with
 * the citekey, renders the shared reference details as its body and
 * offers an Open link action when the reference resolves to a DOI or URL.
 */
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import React from 'react';
import type { Reference } from '@opendraft/references';
import { BottomSheet } from '../components/BottomSheet';
import type { BottomSheetAction } from '../components/BottomSheet';
import { referenceLink } from './citekey-click';
import { ReferenceDetails } from './reference-details';

/** Props for {@link ReferenceSheet}. */
export interface ReferenceSheetProps {
  /** Reference whose citation details are shown. */
  reference: Reference;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

/**
 * Bottom sheet showing a reference's APA citation with an Open link
 * action that opens its DOI or URL in a new tab.
 *
 * @param props - See {@link ReferenceSheetProps}.
 * @returns The reference sheet markup.
 */
export function ReferenceSheet({ reference, onClose }: ReferenceSheetProps): ReactNode {
  const link = referenceLink(reference);
  const action: BottomSheetAction | undefined = link
    ? {
        label: 'Open link',
        onClick: () => {
          window.open(link, '_blank', 'noopener,noreferrer');
          onClose();
        },
      }
    : undefined;

  return (
    <BottomSheet title={reference.citeKey} onClose={onClose} action={action}>
      <ReferenceDetails reference={reference} />
    </BottomSheet>
  );
}

/** Active reference sheet root, if any. */
let sheetRoot: ReturnType<typeof createRoot> | null = null;
/** Active reference sheet container, if any. */
let sheetContainer: HTMLElement | null = null;

/**
 * Mount the reference sheet for a reference into a body container.
 *
 * @param reference - The reference to display.
 * @param onClose - Called after the sheet closes itself; the sheet is
 *   unmounted either way.
 */
export function showReferenceSheet(reference: Reference, onClose?: () => void): void {
  hideReferenceSheet();

  const container = document.createElement('div');
  container.className = 'reference-sheet-container';
  document.body.appendChild(container);
  sheetContainer = container;

  sheetRoot = createRoot(container);
  sheetRoot.render(
    React.createElement(ReferenceSheet, {
      reference,
      onClose: () => {
        hideReferenceSheet();
        onClose?.();
      },
    }),
  );
}

/** Unmount the active reference sheet, if any. */
export function hideReferenceSheet(): void {
  if (sheetRoot) {
    sheetRoot.unmount();
    sheetRoot = null;
  }
  if (sheetContainer) {
    sheetContainer.remove();
    sheetContainer = null;
  }
}
