// @vitest-environment jsdom
/**
 * Publish-to-GitHub form tests: the owner picker with installation state,
 * the slug-prefilled repository name, the visibility choice and the states
 * that keep the primary Publish action disabled.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Finding } from '@opendraft/validate';
import { installUrl } from '../../github/bff-client';
import type { Owner } from '../../github/bff-client';
import type { PreflightResult } from '../../publish/preflight';
import { PublishRepoForm } from './PublishRepoForm';

/** Owners returned by `GET /@api/owners`: one ready, one missing access. */
const OWNERS: Owner[] = [
  {
    login: 'octocat',
    type: 'User',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1?s=64',
    allRepos: true,
  },
  {
    login: 'acme',
    type: 'Organization',
    avatarUrl: 'https://avatars.githubusercontent.com/u/2?s=64',
    allRepos: false,
  },
];

/** Return path used by the install links. */
const RETURN_TO = '/edit?manuscript=demo';

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

/** Render the form with stable default fakes. */
function renderForm(overrides: {
  projectName?: string;
  owners?: Owner[];
  running?: boolean;
  result?: PreflightResult | null;
  onPublish?: (input: {
    owner: string;
    name: string;
    visibility: 'public' | 'private';
  }) => Promise<void> | void;
} = {}) {
  const onPublish = overrides.onPublish ?? vi.fn();
  render(
    <PublishRepoForm
      projectName={overrides.projectName ?? 'My First Paper!'}
      owners={overrides.owners ?? OWNERS}
      returnTo={RETURN_TO}
      running={overrides.running ?? false}
      result={overrides.result ?? clean()}
      onOpenFile={vi.fn()}
      onPublish={onPublish}
    />,
  );
  return { onPublish };
}

describe('PublishRepoForm owner picker', () => {
  it('lists owners with avatars and disables accounts without access', () => {
    renderForm();

    expect(screen.getByRole('img', { name: 'octocat avatar' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'acme avatar' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'octocat' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'acme' })).toBeDisabled();
  });

  it('offers a Manage install link for owners that need access', () => {
    renderForm();

    const manage = screen.getByRole('link', { name: 'needs access · Manage' });
    expect(manage).toHaveAttribute('href', installUrl(RETURN_TO));
  });

  it('offers adding another organization through the install flow', () => {
    renderForm();

    const add = screen.getByRole('link', { name: '+ Add another organization' });
    expect(add).toHaveAttribute('href', installUrl(RETURN_TO));
  });
});

describe('PublishRepoForm name and visibility', () => {
  it('prefills the name from the project name slug', () => {
    renderForm();

    expect(screen.getByLabelText('Name')).toHaveValue('my-first-paper');
  });

  it('offers both visibility choices with private selected by default', () => {
    renderForm();

    expect(screen.getByRole('radio', { name: 'Anyone' })).not.toBeChecked();
    expect(
      screen.getByRole('radio', { name: 'Only people I invite' }),
    ).toBeChecked();
  });
});

describe('PublishRepoForm checks', () => {
  it('renders the preflight checks above the form', () => {
    renderForm();

    expect(screen.getByText('✓ Your manuscript is ready')).toBeInTheDocument();
  });
});

describe('PublishRepoForm primary action', () => {
  it('disables Publish while preflight is running', () => {
    renderForm({ running: true, result: null });

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('disables Publish while preflight reports errors', () => {
    renderForm({ result: broken() });

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('disables Publish when the repository name is empty', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('publishes with the selected owner, name and private visibility', () => {
    const { onPublish } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(onPublish).toHaveBeenCalledWith({
      owner: 'octocat',
      name: 'my-first-paper',
      visibility: 'private',
    });
  });

  it('publishes publicly when the viewer chooses Anyone', () => {
    const { onPublish } = renderForm();

    fireEvent.click(screen.getByRole('radio', { name: 'Anyone' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Shared Paper' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    expect(onPublish).toHaveBeenCalledWith({
      owner: 'octocat',
      name: 'Shared Paper',
      visibility: 'public',
    });
  });
});
