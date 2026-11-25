/**
 * Touch drawer for one byline author. Titles a bottom sheet with the
 * author's display name, renders the shared author details as its body
 * and offers an Edit action only when a handler is supplied.
 */
import type { ReactNode } from 'react';
import { BottomSheet } from '../BottomSheet';
import type { BottomSheetAction } from '../BottomSheet';
import { AuthorDetails } from './AuthorDetails';
import type { BylineAuthor } from './byline-model';

/** Props for {@link AuthorSheet}. */
export interface AuthorSheetProps {
  /** Resolved byline author whose details are shown. */
  author: BylineAuthor;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called when the Edit action is pressed; the action is hidden without it. */
  onEdit?: () => void;
}

/**
 * Bottom sheet showing one author's details with an optional Edit action.
 *
 * @param props - See {@link AuthorSheetProps}.
 * @returns The author sheet markup.
 */
export function AuthorSheet({ author, onClose, onEdit }: AuthorSheetProps): ReactNode {
  const action: BottomSheetAction | undefined = onEdit
    ? { label: 'Edit', onClick: onEdit }
    : undefined;
  return (
    <BottomSheet title={author.name} onClose={onClose} action={action}>
      <AuthorDetails author={author} />
    </BottomSheet>
  );
}
