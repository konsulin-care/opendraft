// @vitest-environment jsdom
/**
 * Publish dialog tests: the send and update variants, the draft-name preview
 * for unpushed drafts, and the states that disable the primary action.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Finding } from '@opendraft/validate';
import type { PreflightResult } from '../../publish/preflight';
import type { DraftNameStatus } from '../../suggest/branches';
import { PublishDialog } from './PublishDialog';
import type { PublishDialogDraft } from './PublishDialog';

/** An unpushed draft owned by the viewer. */
const DRAFT: PublishDialogDraft = {
  owner: 'octocat',
  repo: 'paper',
  login: 'Ada',
  branch: 'od-ada/untitled-draft',
  pushed: false,
};

/** A clean preflight result. */
function clean(): PreflightResult {
  return { ok: true, errors: [], warnings: [] };
}

/** A blocking preflight result. */
function broken(): PreflightResult {
  const finding: Finding = {
    level: 'error',
    location: 'manuscripts/demo',
    path: 'article.qmd',
    message: 'bad assembly',
  };
  return { ok: false, errors: [finding], warnings: [] };
}

/** Render the dialog with stable default fakes. */
function renderDialog(overrides: {
  variant?: 'send' | 'update';
  draft?: PublishDialogDraft;
  runPreflight?: () => Promise<PreflightResult>;
  checkName?: () => Promise<DraftNameStatus>;
}) {
  const checkName = overrides.checkName ?? vi.fn(async () => ({ kind: 'free' as const }));
  const runPreflight = overrides.runPreflight ?? vi.fn(async () => clean());
  render(
    <PublishDialog
      variant={overrides.variant ?? 'send'}
      draft={overrides.draft ?? DRAFT}
      runPreflight={runPreflight}
      checkName={checkName}
      onSubmit={vi.fn()}
      onOpenFile={vi.fn()}
    />,
  );
  return { checkName, runPreflight };
}

describe('PublishDialog send variant', () => {
  it('asks what changed and offers to send for review', () => {
    renderDialog({ variant: 'send' });

    expect(screen.getByLabelText('What did you change?')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Anything reviewers should know? (optional)'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Submit' })).toBeInTheDocument();
  });
});

describe('PublishDialog update variant', () => {
  it("asks what's new and offers to send an update", () => {
    renderDialog({ variant: 'update' });

    expect(screen.getByLabelText("What's new? (optional)")).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Send update' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send update' })).toBeInTheDocument();
    expect(screen.queryByLabelText('What did you change?')).toBeNull();
  });
});

describe('PublishDialog checks', () => {
  it('disables the primary button while preflight is still running', async () => {
    let finish: (result: PreflightResult) => void = () => undefined;
    const pending = new Promise<PreflightResult>((resolve) => {
      finish = resolve;
    });
    renderDialog({ variant: 'update', runPreflight: () => pending });

    expect(screen.getByRole('button', { name: 'Send update' })).toBeDisabled();

    await act(async () => {
      finish(clean());
      await pending;
    });

    expect(screen.getByRole('button', { name: 'Send update' })).toBeEnabled();
  });

  it('disables the primary button when preflight reports errors', async () => {
    renderDialog({ variant: 'update', runPreflight: async () => broken() });

    await screen.findByText('1 thing needs fixing before you send');
    expect(screen.getByRole('button', { name: 'Send update' })).toBeDisabled();
  });

});

describe('PublishDialog draft name', () => {
  it('previews the draft branch and blocks a taken name', async () => {
    renderDialog({
      variant: 'send',
      checkName: async () => ({ kind: 'taken', alternative: 'fix-intro-2' }),
    });

    fireEvent.change(screen.getByLabelText('What did you change?'), {
      target: { value: 'Fix intro' },
    });

    await screen.findByText(
      'A draft with this name already exists. Try "fix-intro-2".',
    );
    expect(
      screen.getByText('Saved on GitHub as od-ada/fix-intro'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('keeps an empty required change field disabled', async () => {
    renderDialog({ variant: 'send' });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled(),
    );
  });
});
