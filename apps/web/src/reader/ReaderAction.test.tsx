// @vitest-environment jsdom
/**
 * ReaderAction tests: the main button label follows the repository kind and
 * viewer access, busy states disable the button with a spinner, and next-step
 * states render the shared popover below the button.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { RepoPermissions } from '../github/bff-client';
import type { EditIntent } from '../suggest/edit-intent';
import type { ReaderRoute } from './route';
import { ReaderAction } from './ReaderAction';
import type { ReaderActionProps } from './ReaderAction';

const ROUTE: ReaderRoute = { owner: 'konsulin-care', repo: 'citizen-science' };

/** Access fixture for a writer on an installed repository. */
const PUSH_INSTALLED: RepoPermissions = {
  push: true,
  installed: true,
  defaultBranch: 'main',
};

/** Access fixture for a reader without push access. */
const READ_ONLY: RepoPermissions = {
  push: false,
  installed: true,
  defaultBranch: 'main',
};

/** Build props with idle defaults for the reader action. */
function props(overrides: Partial<ReaderActionProps> = {}): ReaderActionProps {
  return {
    kind: 'opendraft',
    access: READ_ONLY,
    status: 'idle',
    intent: null,
    error: null,
    route: ROUTE,
    onTrigger: vi.fn(),
    onConvert: vi.fn(),
    ...overrides,
  };
}

describe('ReaderAction label', () => {
  it('converts a non-compliant repository', () => {
    render(<ReaderAction {...props({ kind: 'non-compliant' })} />);

    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeInTheDocument();
  });

  it('edits an OpenDraft repository when the viewer can push and the app is installed', () => {
    render(<ReaderAction {...props({ access: PUSH_INSTALLED })} />);

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('suggests edits otherwise', () => {
    render(<ReaderAction {...props({ access: READ_ONLY })} />);

    expect(screen.getByRole('button', { name: 'Suggest edits' })).toBeInTheDocument();
  });

  it('calls onConvert for a non-compliant repository and onTrigger otherwise', () => {
    const onConvert = vi.fn();
    const onTrigger = vi.fn();
    const { unmount } = render(
      <ReaderAction {...props({ kind: 'non-compliant', onConvert, onTrigger })} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));
    expect(onConvert).toHaveBeenCalledTimes(1);
    unmount();

    render(<ReaderAction {...props({ onConvert, onTrigger })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest edits' }));
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});

describe('ReaderAction icons', () => {
  it('shows a Pencil icon on the Edit action', () => {
    const { container } = render(<ReaderAction {...props({ access: PUSH_INSTALLED })} />);

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button.querySelector('[data-testid="reader-action-icon"]')).not.toBeNull();
    expect(container.querySelector('.lucide-pencil')).not.toBeNull();
  });

  it('shows GitPullRequestCreate for Suggest edits and Upload for Convert to OpenDraft', () => {
    const { unmount } = render(<ReaderAction {...props({ access: READ_ONLY })} />);
    expect(document.querySelector('.lucide-git-pull-request-create')).not.toBeNull();
    unmount();

    render(<ReaderAction {...props({ kind: 'non-compliant' })} />);
    expect(document.querySelector('.lucide-upload')).not.toBeNull();
  });

  it('hides its visible label below 400px while keeping the accessible name', () => {
    render(<ReaderAction {...props({ access: READ_ONLY })} />);

    const button = screen.getByRole('button', { name: 'Suggest edits' });
    expect(button).toHaveAttribute('aria-label', 'Suggest edits');
    expect(button).toHaveAttribute('title', 'Suggest edits');
    expect(screen.getByText('Suggest edits')).toHaveClass('hidden', 'min-[400px]:inline');
  });
});

describe('ReaderAction busy states', () => {
  it('is disabled with a spinner while checking and keeps its label', () => {
    render(<ReaderAction {...props({ status: 'checking' })} />);

    const button = screen.getByRole('button', { name: 'Suggest edits' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('reader-action-spinner')).toHaveClass('animate-spin');
  });

  it('is disabled with a spinner and reads "Preparing your copy…" while starting', () => {
    render(<ReaderAction {...props({ status: 'starting' })} />);

    const button = screen.getByRole('button', { name: 'Preparing your copy…' });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('reader-action-spinner')).toHaveClass('animate-spin');
  });

  it('ignores clicks while busy', () => {
    const onTrigger = vi.fn();
    render(<ReaderAction {...props({ status: 'checking', onTrigger })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Suggest edits' }));
    expect(onTrigger).not.toHaveBeenCalled();
  });
});

describe('ReaderAction popovers', () => {
  it('renders the sign-in popover under the button', () => {
    render(<ReaderAction {...props({ intent: { kind: 'sign-in' } })} />);

    expect(screen.getByRole('dialog', { name: 'Sign in to suggest edits' })).toBeInTheDocument();
  });

  it('renders the install popover under the button', () => {
    const intent: EditIntent = { kind: 'install', scope: 'personal' };
    render(<ReaderAction {...props({ intent })} />);

    expect(screen.getByRole('dialog', { name: 'One more step' })).toBeInTheDocument();
  });

  it('renders the blocked popover under the button', () => {
    const intent: EditIntent = { kind: 'blocked', reason: 'upstream_not_installed' };
    render(<ReaderAction {...props({ intent })} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByText("The owners haven't enabled OpenDraft on this repository."),
    ).toBeInTheDocument();
  });

  it('renders the error popover under the button and retries from it', () => {
    const onRetry = vi.fn();
    render(
      <ReaderAction
        {...props({ error: 'The network is unavailable.', onRetry })}
      />,
    );

    expect(screen.getByRole('dialog', { name: "Couldn't prepare your copy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
