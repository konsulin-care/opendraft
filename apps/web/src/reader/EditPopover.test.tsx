// @vitest-environment jsdom
/**
 * Edit popover tests: sign-in, install, blocked and error copy, intent links,
 * retry handling and closing on Escape or an outside press.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { installUrl, loginUrl } from '../github/bff-client';
import type { ReaderRoute } from './route';
import { EditPopover } from './EditPopover';

const ROUTE: ReaderRoute = { owner: 'konsulin-care', repo: 'citizen-science' };
const INTENT_PATH = '/konsulin-care/citizen-science?intent=edit';

describe('EditPopover sign-in variants', () => {
  it('shows the edit hint and a GitHub link that carries the intent path', () => {
    render(
      <EditPopover variant="sign-in" purpose="edit" route={ROUTE} onClose={vi.fn()} />,
    );

    expect(
      screen.getByText(
        'Suggestions are saved under your free GitHub account. No account? Create one with an existing Google account just in two clicks.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Sign in to suggest edits')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in with GitHub' })).toHaveAttribute(
      'href',
      loginUrl(INTENT_PATH),
    );
  });

  it('shows the convert text and keeps the manuscript in the intent path', () => {
    render(
      <EditPopover
        variant="sign-in"
        purpose="convert"
        route={ROUTE}
        manuscriptId="paper"
        onClose={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Sign in to check whether you can convert this repository.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in with GitHub' })).toHaveAttribute(
      'href',
      loginUrl('/konsulin-care/citizen-science?manuscript=paper&intent=edit'),
    );
  });
});

describe('EditPopover install variants', () => {
  it('asks for a personal all-repositories install', () => {
    render(
      <EditPopover variant="install" scope="personal" route={ROUTE} onClose={vi.fn()} />,
    );

    expect(screen.getByText('One more step')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Install OpenDraft on your GitHub account and choose "All repositories" so we can create your copy.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Install OpenDraft' })).toHaveAttribute(
      'href',
      installUrl(INTENT_PATH),
    );
  });

  it('asks the writer to install OpenDraft on the repository', () => {
    render(
      <EditPopover variant="install" scope="upstream" route={ROUTE} onClose={vi.fn()} />,
    );

    expect(screen.getByText("OpenDraft isn't installed here")).toBeInTheDocument();
    expect(
      screen.getByText(
        'You can edit this repository. Install OpenDraft on it to start suggesting edits.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Install OpenDraft' })).toHaveAttribute(
      'href',
      installUrl(INTENT_PATH),
    );
  });
});

describe('EditPopover blocked variants', () => {
  it('explains that the owners have not enabled OpenDraft and shows no button', () => {
    render(
      <EditPopover
        variant="blocked"
        reason="upstream_not_installed"
        route={ROUTE}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Suggestions aren't available")).toBeInTheDocument();
    expect(
      screen.getByText("The owners haven't enabled OpenDraft on this repository."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('asks for collaborator access when the repository disallows forks', () => {
    render(
      <EditPopover variant="blocked" reason="fork_disabled" route={ROUTE} onClose={vi.fn()} />,
    );

    expect(
      screen.getByText('Ask a maintainer to add you as a collaborator.'),
    ).toBeInTheDocument();
  });

  it('falls back to the server-wide explanation', () => {
    render(
      <EditPopover variant="blocked" reason="login_disabled" route={ROUTE} onClose={vi.fn()} />,
    );

    expect(
      screen.getByText('OpenDraft suggestions are not available on this server.'),
    ).toBeInTheDocument();
  });
});

describe('EditPopover error variant', () => {
  it('shows the message and calls onRetry from the Try again button', () => {
    const onRetry = vi.fn();
    render(
      <EditPopover
        variant="error"
        message="The network is unavailable."
        route={ROUTE}
        onRetry={onRetry}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Couldn't prepare your copy")).toBeInTheDocument();
    expect(screen.getByText('The network is unavailable.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EditPopover dismissal', () => {
  it('is a dialog that closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <EditPopover variant="sign-in" purpose="edit" route={ROUTE} onClose={onClose} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when a press lands outside the popover', () => {
    const onClose = vi.fn();
    render(
      <EditPopover variant="sign-in" purpose="edit" route={ROUTE} onClose={onClose} />,
    );

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for a press inside the popover', () => {
    const onClose = vi.fn();
    render(
      <EditPopover variant="sign-in" purpose="edit" route={ROUTE} onClose={onClose} />,
    );

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
