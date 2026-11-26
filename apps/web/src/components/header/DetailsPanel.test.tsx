// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ProjectSource, ProjectSourceGitHub } from '@opendraft/workspace';
import type { HeaderStatus } from '../../hooks/draft-header-status';
import { DetailsPanel } from './DetailsPanel';
import type { DetailsPanelProps } from './DetailsPanel';

const GITHUB: ProjectSourceGitHub = {
  kind: 'github',
  owner: 'konsulin',
  repo: 'opendraft',
  branch: 'draft/alpha',
  upstream: { owner: 'konsulin', repo: 'opendraft', defaultBranch: 'main' },
  private: false,
  pushed: true,
  syncedSha: 'abc',
  digest: {},
  pullNumber: 12,
};

const LOCAL: ProjectSource = { kind: 'local' };

const STATUS: HeaderStatus = {
  draftLabel: '2 saves waiting to upload',
  branch: 'draft/alpha',
  pullRequestUrl: 'https://github.com/konsulin/opendraft/pull/12',
  notice: null,
  attention: false,
};

/**
 * Render the panel with optional prop overrides.
 *
 * @param overrides - Props replacing the defaults.
 * @returns The testing-library render result.
 */
function renderPanel(overrides: Partial<DetailsPanelProps> = {}) {
  return render(
    <DetailsPanel
      id="manuscript-details"
      onClose={vi.fn()}
      name="Alpha study"
      onRename={vi.fn()}
      source={GITHUB}
      saveStatus="saved"
      status={STATUS}
      {...overrides}
    />,
  );
}

/** Return the details region. */
function panel(): HTMLElement {
  return screen.getByRole('region', { name: 'Manuscript details' });
}

describe('DetailsPanel rows', () => {
  it('renders the rows in order: manuscript id, location, saved line, branch, status', () => {
    renderPanel();

    const text = panel().textContent ?? '';
    const positions = [
      'Manuscript ID',
      'Published at',
      'Changes are saved in this browser',
      'Local branch',
      'Status',
    ].map((label) => text.indexOf(label));

    for (const position of positions) expect(position).toBeGreaterThanOrEqual(0);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });

  it('edits the manuscript name through the inline field', () => {
    const onRename = vi.fn();
    renderPanel({ onRename });

    const input = within(panel()).getByLabelText('Manuscript name');
    expect(input).toHaveAttribute('data-testid', 'manuscript-title');
    expect(input).toHaveValue('Alpha study');

    fireEvent.change(input, { target: { value: 'Beta study' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('Beta study');
  });

  it('omits the manuscript id row when no name is given', () => {
    renderPanel({ name: undefined });

    expect(within(panel()).queryByText('Manuscript ID')).toBeNull();
  });
});

describe('DetailsPanel location', () => {
  it('links the repository for a GitHub project', () => {
    renderPanel();

    const link = within(panel()).getByRole('link', { name: /konsulin\/opendraft/ });
    expect(link).toHaveAttribute('href', 'https://github.com/konsulin/opendraft');
  });

  it('shows only-on-device for a local project without a branch row', () => {
    renderPanel({
      source: LOCAL,
      status: { draftLabel: '3 saves waiting to upload', notice: null, attention: false },
    });

    expect(within(panel()).getByText('Only on this device')).toBeInTheDocument();
    expect(within(panel()).queryByText('Local branch')).toBeNull();
    expect(within(panel()).queryByRole('link', { name: /github\.com/ })).toBeNull();
  });
});

describe('DetailsPanel status row', () => {
  it('combines the save and draft labels', () => {
    renderPanel();

    expect(panel()).toHaveTextContent('Saved · 2 saves waiting to upload');
  });

  it('links the suggestion when a pull request url exists', () => {
    renderPanel();

    const link = within(panel()).getByRole('link', { name: /View suggestion/ });
    expect(link).toHaveAttribute('href', STATUS.pullRequestUrl);
  });

  it('shows the notice and no suggestion link without a pull request', () => {
    renderPanel({
      saveStatus: 'error',
      status: {
        draftLabel: '1 save waiting to upload',
        notice: 'Upload failed',
        attention: true,
      },
    });

    expect(panel()).toHaveTextContent('Save failed · 1 save waiting to upload');
    expect(panel()).toHaveTextContent('Upload failed');
    expect(within(panel()).queryByRole('link', { name: /View suggestion/ })).toBeNull();
  });
});

describe('DetailsPanel picker switch', () => {
  it('keeps the editable name and calls onOpenPicker from the switch button', () => {
    const onOpenPicker = vi.fn();
    renderPanel({ onOpenPicker });

    const input = within(panel()).getByLabelText('Manuscript name');
    expect(input).toHaveValue('Alpha study');

    const button = within(panel()).getByRole('button', { name: 'Switch manuscript' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');

    fireEvent.click(button);

    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it('renders the plain editable field without a switch button when onOpenPicker is absent', () => {
    renderPanel();

    expect(within(panel()).getByLabelText('Manuscript name')).toBeInTheDocument();
    expect(within(panel()).queryByRole('button', { name: 'Switch manuscript' })).toBeNull();
  });
});

describe('DetailsPanel close controls', () => {
  it('closes through the close details button', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes through the aria-hidden scrim below md', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    const scrim = screen.getByTestId('surface-scrim');
    expect(scrim).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(scrim);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
