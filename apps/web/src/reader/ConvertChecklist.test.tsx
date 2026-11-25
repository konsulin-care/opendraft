// @vitest-environment jsdom
/**
 * ConvertChecklist tests: registrable candidates render checked by default,
 * rejected candidates render disabled with their reason and suggested id, and
 * submitting reports either the checked ids or a normalized new project name.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ManuscriptCandidate, ProjectDiscovery } from '@opendraft/manuscript';
import { ConvertChecklist } from './ConvertChecklist';

/** Build a discovery fixture from the given candidates. */
function discovery(candidates: ManuscriptCandidate[]): ProjectDiscovery {
  return {
    config: 'missing',
    configErrors: [],
    listed: [],
    candidates,
    unlisted: [],
  };
}

/** Build a valid candidate fixture. */
function valid(id: string): ManuscriptCandidate {
  return {
    id,
    path: `manuscripts/${id}`,
    status: 'valid',
    layout: 'legacy',
    missingFiles: [],
    warnings: [],
  };
}

/** Mixed candidates covering valid, repairable and rejected rows. */
const MIXED: ManuscriptCandidate[] = [
  valid('alpha'),
  {
    ...valid('beta'),
    status: 'repairable',
    missingFiles: ['_author.yml'],
  },
  {
    ...valid('Bad Name'),
    status: 'rejected',
    reason: 'invalid-id',
    suggestedId: 'case-series',
  },
];

describe('ConvertChecklist candidates', () => {
  it('checks registrable candidates and reports what a repair will create', () => {
    render(
      <ConvertChecklist
        discovery={discovery(MIXED)}
        defaultId="my-paper"
        running={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('checkbox', { name: /alpha/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /beta/ })).toBeChecked();
    expect(screen.getByText('will create _author.yml')).toBeInTheDocument();

    const rejected = screen.getByRole('checkbox', { name: /Bad Name/ });
    expect(rejected).toBeDisabled();
    expect(screen.getByText('invalid-id')).toBeInTheDocument();
    expect(screen.getByText('suggested id: case-series')).toBeInTheDocument();
  });

  it('submits the checked candidate ids when candidates exist', () => {
    const onSubmit = vi.fn();
    render(
      <ConvertChecklist
        discovery={discovery([valid('alpha'), valid('beta')])}
        defaultId="my-paper"
        running={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /beta/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(onSubmit).toHaveBeenCalledWith({ register: ['alpha'] });
  });
});

describe('ConvertChecklist new project', () => {
  it('asks for a project name and submits its normalized manuscript id', () => {
    const onSubmit = vi.fn();
    render(
      <ConvertChecklist
        discovery={discovery([])}
        defaultId="my-paper"
        running={false}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByRole('checkbox')).toBeNull();
    const input = screen.getByLabelText('Project name');
    expect(input).toHaveValue('my-paper');

    fireEvent.change(input, { target: { value: 'My Paper' } });
    fireEvent.click(screen.getByRole('button', { name: 'Convert to OpenDraft' }));

    expect(onSubmit).toHaveBeenCalledWith({ newManuscriptId: 'my-paper' });
  });
});
