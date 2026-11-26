// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { APP_BAR_HEIGHT } from '../app-bar-layout';
import { HeaderShell } from './HeaderShell';

describe('HeaderShell slots', () => {
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

describe('HeaderShell subtitle clipping', () => {
  it('leaves the subtitle unclipped so the dashed link underline is not cut off', () => {
    render(<HeaderShell title="Title" subtitle="Forked from owner/repository" />);

    const subtitle = screen.getByText('Forked from owner/repository');
    expect(subtitle.className).not.toMatch(/\btruncate\b/);
    expect(subtitle.className.split(/\s+/)).toContain('leading-5');
    expect(subtitle.className.split(/\s+/)).toContain('min-w-0');
  });

  it('leaves the subtitle unclipped when a panel is supplied too', () => {
    render(
      <HeaderShell
        title="Title"
        subtitle="Forked from owner/repository"
        panel={<div data-testid="panel-slot" />}
      />,
    );

    const subtitle = screen.getByText('Forked from owner/repository');
    expect(subtitle.className).not.toMatch(/\btruncate\b/);
    expect(subtitle.className.split(/\s+/)).toContain('leading-5');
  });
});

describe('HeaderShell panel', () => {
  it('renders the panel slot inside the header element', () => {
    render(
      <HeaderShell
        title={<span>TITLE-SLOT</span>}
        userMenu={<span>USER-MENU-SLOT</span>}
        panel={<div data-testid="panel-slot">PANEL-SLOT</div>}
      />,
    );

    const header = screen.getByTestId('header-shell');
    expect(within(header).getByTestId('panel-slot')).toBeInTheDocument();
    const text = header.textContent ?? '';
    expect(text.indexOf('USER-MENU-SLOT')).toBeLessThan(text.indexOf('PANEL-SLOT'));
  });

  it('hides the subtitle below md only when a panel is supplied', () => {
    const { unmount } = render(
      <HeaderShell
        title="Title"
        subtitle="SUBTITLE-SLOT"
        panel={<div data-testid="panel-slot" />}
      />,
    );
    const withPanel = screen.getByText('SUBTITLE-SLOT');
    expect(withPanel.className).toMatch(/\bhidden\b/);
    expect(withPanel.className).toMatch(/\bmd:block\b/);
    unmount();

    render(<HeaderShell title="Title" subtitle="SUBTITLE-SLOT" />);
    const withoutPanel = screen.getByText('SUBTITLE-SLOT');
    expect(withoutPanel.className).not.toMatch(/\bhidden\b/);
    expect(withoutPanel.className).not.toMatch(/\bmd:block\b/);
    expect(withoutPanel.className).toMatch(/\bblock\b/);
  });
});

describe('HeaderShell spacing', () => {
  it('uses compact spacing classes and a title column with a min-width floor', () => {
    render(<HeaderShell title="Title" subtitle="Only on this device" />);

    const header = screen.getByTestId('header-shell');
    for (const cls of ['gap-1.5', 'px-2', 'sm:gap-2', 'sm:px-3']) {
      expect(header.className.split(/\s+/)).toContain(cls);
    }
    const titleColumn = screen.getByTestId('header-title-column');
    expect(titleColumn.className.split(/\s+/)).toContain('min-w-[7rem]');
  });

  it('gives the title column room for two lines instead of a fixed height', () => {
    render(<HeaderShell title="Title" subtitle="Only on this device" />);

    const classes = screen.getByTestId('header-title-column').className.split(/\s+/);
    expect(classes).toContain('min-h-9');
    expect(classes).not.toContain('h-9');
  });
});
