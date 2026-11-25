// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { APP_BAR_HEIGHT } from '../app-bar-layout';
import { HeaderShell } from './HeaderShell';

describe('HeaderShell', () => {
  it('renders the leading, title, subtitle, action and user menu slots in order', () => {
    render(
      <HeaderShell
        leading={<span>LEADING-SLOT</span>}
        title={<span>TITLE-SLOT</span>}
        subtitle="SUBTITLE-SLOT"
        extra={<span>EXTRA-SLOT</span>}
        action={<button type="button">ACTION-SLOT</button>}
        userMenu={<span>USER-MENU-SLOT</span>}
      />,
    );

    const header = screen.getByTestId('header-shell');
    const text = header.textContent ?? '';
    expect(text.indexOf('LEADING-SLOT')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('LEADING-SLOT')).toBeLessThan(text.indexOf('TITLE-SLOT'));
    expect(text.indexOf('TITLE-SLOT')).toBeLessThan(text.indexOf('SUBTITLE-SLOT'));
    expect(text.indexOf('SUBTITLE-SLOT')).toBeLessThan(text.indexOf('EXTRA-SLOT'));
    expect(text.indexOf('EXTRA-SLOT')).toBeLessThan(text.indexOf('ACTION-SLOT'));
    expect(text.indexOf('ACTION-SLOT')).toBeLessThan(text.indexOf('USER-MENU-SLOT'));
  });

  it('renders the subtitle as plain read-only text without an input', () => {
    render(<HeaderShell title="Title" subtitle="Only on this device" />);

    const header = screen.getByTestId('header-shell');
    expect(within(header).getByText('Only on this device')).toBeInTheDocument();
    expect(within(header).queryByRole('textbox')).toBeNull();
  });

  it('truncates the subtitle with an ellipsis', () => {
    render(<HeaderShell title="Title" subtitle="Forked from owner/repository" />);

    const subtitle = screen.getByText('Forked from owner/repository');
    expect(subtitle.className).toMatch(/\btruncate\b/);
  });

  it('keeps the app bar height and the existing header border styles', () => {
    render(<HeaderShell title="Title" subtitle="Only on this device" />);

    const header = screen.getByTestId('header-shell');
    for (const cls of APP_BAR_HEIGHT.split(/\s+/)) {
      expect(header.className.split(/\s+/)).toContain(cls);
    }
    expect(header.className).toMatch(/\bborder-b\b/);
    expect(header.className).toMatch(/\bborder-gray-200\b/);
    expect(header.className).toMatch(/\bbg-white\b/);
  });
});
