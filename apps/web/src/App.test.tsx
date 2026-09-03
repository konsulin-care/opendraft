import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});