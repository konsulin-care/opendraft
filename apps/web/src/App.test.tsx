import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { App } from './App';

// @vitest-environment jsdom

describe('App', () => {
  it('boots into the single manuscript editor', async () => {
    render(<App />);
    await waitFor(
      () => expect(screen.getByTestId('manuscript-editor')).toBeDefined(),
      { timeout: 10000 },
    );
  });

  it('shows the header with commit action', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('OpenDraft')).toBeDefined());
    expect(screen.getByText('Commit')).toBeDefined();
  });

  it('shows a Source toggle button in the header', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });
    expect(screen.getByText('Source')).toBeDefined();
  });

  it('toggles to Visual mode and back when the button is clicked', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('manuscript-editor')).toBeDefined(), { timeout: 10000 });

    // Initial state: button reads 'Source' (to switch TO source)
    const toggle = screen.getByRole('button', { name: /source/i });
    fireEvent.click(toggle);

    // After click: button reads 'Visual' (to switch back to wysiwyg)
    expect(screen.getByText('Visual')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /visual/i }));

    // After second click: button reads 'Source' again
    expect(screen.getByText('Source')).toBeDefined();
  });
});