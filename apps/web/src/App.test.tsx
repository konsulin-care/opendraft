import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

// @vitest-environment jsdom

describe('App', () => {
  it('renders manuscript workspace', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Manuscript')).toBeDefined();
    });
  });

  it('shows sidebar navigation', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getAllByText('Blocks').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Metadata').length).toBeGreaterThan(0);
      expect(screen.getAllByText('References').length).toBeGreaterThan(0);
    });
  });
});
