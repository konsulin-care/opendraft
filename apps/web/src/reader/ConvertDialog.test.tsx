// @vitest-environment jsdom
/**
 * ConvertDialog tests: the modal hosts the conversion checklist, submits the
 * chosen decisions, shows the pull request or compare outcome after success,
 * reports failures as an alert, and disables submission while running.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type {
  InitDecisions,
  ManuscriptCandidate,
  ProjectDiscovery,
} from '@opendraft/manuscript';
import type { ConvertResult } from './convert';
import { ConvertDialog } from './ConvertDialog';

/** Build a discovery fixture with one valid candidate per id. */
function discovery(ids: string[]): ProjectDiscovery {
  const candidates: ManuscriptCandidate[] = ids.map((id) => ({
    id,
    path: `manuscripts/${id}`,
    status: 'valid',
    layout: 'legacy',
    missingFiles: [],
    warnings: [],
  }));
  return {
    config: 'missing',
    configErrors: [],
    listed: [],
    candidates,
    unlisted: [],
  };
}

/** Render the dialog with a convert spy and an optional close spy. */
function renderDialog(
  convert: (decisions: InitDecisions) => Promise<ConvertResult>,
  ids: string[] = ['alpha', 'beta'],
) {
  return render(
    <ConvertDialog
      discovery={discovery(ids)}
      defaultId="opendraft"
      convert={convert}
      onClose={vi.fn()}
    />,
  );
}

describe('ConvertDialog checklist', () => {
  it('renders the convert checklist and passes the chosen decisions to convert', async () => {
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      async () => ({ kind: 'pr', url: 'https://github.com/octocat/draft/pull/7' }),
    );
    renderDialog(convert);

    expect(
      screen.getByRole('dialog', { name: 'Convert to OpenDraft' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /beta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    await screen.findByRole('link', { name: 'View pull request' });
    expect(convert).toHaveBeenCalledTimes(1);
    expect(convert).toHaveBeenCalledWith({ register: ['alpha'] });
  });
});

describe('ConvertDialog outcome', () => {
  it('shows a pull request link for a direct result', async () => {
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      async () => ({ kind: 'pr', url: 'https://github.com/octocat/draft/pull/7' }),
    );
    renderDialog(convert);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    const link = await screen.findByRole('link', { name: 'View pull request' });
    expect(link).toHaveAttribute('href', 'https://github.com/octocat/draft/pull/7');
  });

  it('shows a GitHub compare link for a fork result', async () => {
    const compare =
      'https://github.com/octocat/draft/compare/main...octocat:opendraft/init?expand=1';
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      async () => ({ kind: 'compare', url: compare }),
    );
    renderDialog(convert);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    const link = await screen.findByRole('link', { name: 'Open pull request on GitHub' });
    expect(link).toHaveAttribute('href', compare);
  });
});

describe('ConvertDialog conversion state', () => {
  it('shows failures as an alert and re-enables submission', async () => {
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      async () => {
        throw new Error('branch exists');
      },
    );
    renderDialog(convert);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('branch exists');
    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeEnabled();
  });

  it('disables submission while the conversion is running', async () => {
    let resolve: (value: ConvertResult) => void = () => undefined;
    const convert = vi.fn<(decisions: InitDecisions) => Promise<ConvertResult>>(
      () =>
        new Promise<ConvertResult>((done) => {
          resolve = done;
        }),
    );
    renderDialog(convert);

    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeDisabled();
    resolve({ kind: 'pr', url: 'https://github.com/octocat/draft/pull/7' });
    await screen.findByRole('link', { name: 'View pull request' });
    expect(screen.getByRole('button', { name: 'Convert to OpenDraft' })).toBeEnabled();
  });
});
