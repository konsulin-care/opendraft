// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RepoSubtitle } from './RepoSubtitle';

describe('RepoSubtitle', () => {
  it('renders the prefix as plain text and only owner/repo as an external link', () => {
    render(
      <RepoSubtitle prefix="Published at" repo="konsulin/opendraft" href="https://github.com/konsulin/opendraft" />,
    );

    expect(screen.getByText('Published at')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /konsulin\/opendraft/ });
    expect(link).toHaveAttribute('href', 'https://github.com/konsulin/opendraft');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    const prefix = screen.getByText('Published at');
    expect(prefix.textContent).toBe('Published at');
  });

  it('styles the repo link and shows a decorative external icon', () => {
    render(<RepoSubtitle prefix="Forked from" repo="konsulin/opendraft" href="https://github.com/konsulin/opendraft" />);

    const link = screen.getByRole('link', { name: /konsulin\/opendraft/ });
    for (const cls of ['text-black', 'underline', 'decoration-dashed']) {
      expect(link.className.split(/\s+/)).toContain(cls);
    }

    const icon = link.querySelector('svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the prefix only and no link without an href', () => {
    render(<RepoSubtitle prefix="Only on this device" />);

    expect(screen.getByText('Only on this device')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
