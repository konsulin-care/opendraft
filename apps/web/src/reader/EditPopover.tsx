/**
 * Popover anchored under the reader's main action.
 *
 * It explains the next step a viewer must take before they can edit or convert
 * a repository: sign in, install the GitHub App, or why suggestions are blocked.
 * Errors that happen while preparing a copy use the same surface and offer a
 * retry. The popover closes on Escape or when a press lands outside it.
 */

import { useEffect, useRef } from 'react';
import type { BlockedReason, InstallScope } from '../suggest/edit-intent';
import { installUrl, loginUrl } from '../github/bff-client';
import { intentPath } from './intent-url';
import type { ReaderRoute } from './route';

/** Which explanation the popover shows. */
export type EditPopoverVariant = 'sign-in' | 'install' | 'blocked' | 'error';

/** The action that opened the popover; changes the sign-in copy. */
export type EditPopoverPurpose = 'edit' | 'convert';

/** Props for {@link EditPopover}. */
export interface EditPopoverProps {
  /** Explanation to show. */
  variant: EditPopoverVariant;
  /** Repository owner, name and optional ref from the reader URL. */
  route: ReaderRoute;
  /** Action that opened the popover; defaults to `edit`. */
  purpose?: EditPopoverPurpose;
  /** Installation to offer for the `install` variant; defaults to `personal`. */
  scope?: InstallScope;
  /** Reason for the `blocked` variant. */
  reason?: BlockedReason;
  /** Error message for the `error` variant. */
  message?: string;
  /** Manuscript to keep selected in the intent path. */
  manuscriptId?: string;
  /** Retry the failed preparation; invoked by the `Try again` button. */
  onRetry?: () => void;
  /** Close the popover. */
  onClose: () => void;
}

const SIGN_IN_EDIT_TEXT =
  'Suggestions are saved under your free GitHub account. No account? Create one with an existing Google account just in two clicks.';
const SIGN_IN_CONVERT_TEXT = 'Sign in to check whether you can convert this repository.';
const INSTALL_PERSONAL_TEXT =
  'Install OpenDraft on your GitHub account and choose "All repositories" so we can create your copy.';
const INSTALL_UPSTREAM_TEXT =
  'You can edit this repository. Install OpenDraft on it to start suggesting edits.';

const PANEL =
  'absolute right-0 z-40 mt-2 w-80 rounded-md border border-gray-200 bg-white p-4 shadow-lg';
const PRIMARY_LINK =
  'inline-flex self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white';
const PRIMARY_BUTTON =
  'inline-flex self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white';

/** Close an open popover when Escape is pressed. */
function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
}

/** Close an open popover when a press lands outside its panel. */
function useOutsideClose(
  panelRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
): void {
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent): void => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose, panelRef]);
}

/** Return the plain-language explanation for a blocked plan. */
function blockedMessage(reason: BlockedReason | undefined): string {
  switch (reason) {
    case 'upstream_not_installed':
      return "The owners haven't enabled OpenDraft on this repository.";
    case 'fork_disabled':
      return 'Ask a maintainer to add you as a collaborator.';
    default:
      return 'OpenDraft suggestions are not available on this server.';
  }
}

/** Title shown for each popover variant. */
function popoverTitle(
  variant: EditPopoverVariant,
  purpose: EditPopoverPurpose,
  scope: InstallScope,
): string {
  if (variant === 'sign-in') {
    return purpose === 'convert'
      ? 'Sign in to convert this repository'
      : 'Sign in to suggest edits';
  }
  if (variant === 'install') {
    return scope === 'upstream' ? "OpenDraft isn't installed here" : 'One more step';
  }
  if (variant === 'blocked') return "Suggestions aren't available";
  return "Couldn't prepare your copy";
}

/** Props for {@link PopoverBody}. */
interface PopoverBodyProps {
  variant: EditPopoverVariant;
  purpose: EditPopoverPurpose;
  scope: InstallScope;
  reason: BlockedReason | undefined;
  message: string | undefined;
  href: string;
  onRetry: () => void;
}

/** Text and action for the current variant. */
function PopoverBody({
  variant,
  purpose,
  scope,
  reason,
  message,
  href,
  onRetry,
}: PopoverBodyProps) {
  if (variant === 'sign-in') {
    return (
      <>
        <p className="text-sm text-gray-700">
          {purpose === 'convert' ? SIGN_IN_CONVERT_TEXT : SIGN_IN_EDIT_TEXT}
        </p>
        <a href={href} className={PRIMARY_LINK}>
          Sign in with GitHub
        </a>
      </>
    );
  }

  if (variant === 'install') {
    return (
      <>
        <p className="text-sm text-gray-700">
          {scope === 'upstream' ? INSTALL_UPSTREAM_TEXT : INSTALL_PERSONAL_TEXT}
        </p>
        <a href={href} className={PRIMARY_LINK}>
          Install OpenDraft
        </a>
      </>
    );
  }

  if (variant === 'blocked') {
    return <p className="text-sm text-gray-700">{blockedMessage(reason)}</p>;
  }

  return (
    <>
      <p className="text-sm text-gray-700">{message}</p>
      <button type="button" onClick={onRetry} className={PRIMARY_BUTTON}>
        Try again
      </button>
    </>
  );
}

/**
 * Render the next-step popover for the reader's main action.
 *
 * The element positions itself under a relatively positioned action and stays
 * inert until dismissed: there is no close button, so `blocked` really shows
 * no action at all.
 *
 * @param props - See {@link EditPopoverProps}.
 * @returns The dialog panel with the variant's copy and action.
 */
export function EditPopover({
  variant,
  route,
  purpose = 'edit',
  scope = 'personal',
  reason,
  message,
  manuscriptId,
  onRetry,
  onClose,
}: EditPopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEscapeClose(onClose);
  useOutsideClose(panelRef, onClose);

  const path = intentPath(route, manuscriptId);
  const href = variant === 'install' ? installUrl(path) : loginUrl(path);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={popoverTitle(variant, purpose, scope)}
      className={PANEL}
    >
      <h2 className="mb-2 text-sm font-semibold text-gray-900">
        {popoverTitle(variant, purpose, scope)}
      </h2>
      <div className="flex flex-col gap-3">
        <PopoverBody
          variant={variant}
          purpose={purpose}
          scope={scope}
          reason={reason}
          message={message}
          href={href}
          onRetry={onRetry ?? (() => undefined)}
        />
      </div>
    </div>
  );
}

export default EditPopover;
