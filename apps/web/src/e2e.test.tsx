import 'fake-indexeddb/auto';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from './App';

// @vitest-environment jsdom

async function clearIndexedDB() {
  const dbs = await indexedDB.databases();
  for (const db of dbs) {
    if (db.name) indexedDB.deleteDatabase(db.name);
  }
}

async function waitForApp() {
  await waitFor(() => expect(screen.getByText('Manuscript')).toBeDefined());
}

describe('End-to-end manuscript workflow', () => {
  beforeEach(clearIndexedDB);

  it('seeds a default manuscript on first run', async () => {
    const { unmount } = render(<App />);
    await waitForApp();

    // Seed contents are asserted in seed.test.ts; the block-list UI is
    // replaced by the block rail in the manuscript editor step.
    await waitFor(() => expect(screen.getAllByText('Blocks').length).toBeGreaterThan(0));
    // Let in-flight workspace reads settle before unmount to avoid
    // polluting the next test's IndexedDB lifecycle.
    await new Promise((r) => setTimeout(r, 50));
    unmount();
  });

  it('persists metadata changes across reloads', async () => {
    const { unmount } = render(<App />);
    await waitForApp();

    // Switch to Metadata and edit
    fireEvent.click(screen.getAllByText('Metadata')[0]);
    await waitFor(() => expect(screen.getByText('_author.yml')).toBeDefined());

    const textarea = screen.getAllByPlaceholderText(/_author\.yml/i)[0];
    fireEvent.change(textarea, { target: { value: 'name: Test Author' } });
    await waitFor(() => expect(textarea).toHaveValue('name: Test Author'));

    // Simulate reload
    unmount();
    render(<App />);
    await waitForApp();

    // Verify persistence
    fireEvent.click(screen.getAllByText('Metadata')[0]);
    await waitFor(() => expect(screen.getByText('_author.yml')).toBeDefined());

    const textareaAfter = screen.getAllByPlaceholderText(/_author\.yml/i)[0];
    expect(textareaAfter).toHaveValue('name: Test Author');
  });
});
