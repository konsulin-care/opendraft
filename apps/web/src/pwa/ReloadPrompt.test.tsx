// @vitest-environment jsdom
/**
 * ReloadPrompt tests: the update toast only appears when a refresh is needed,
 * its Reload action triggers the service worker update and disables itself, and
 * Close dismisses the prompt.
 */
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ReloadPrompt } from './ReloadPrompt';

/**
 * Build a fake `useRegisterSW` hook that keeps its refresh flag in React state.
 *
 * @param initialNeedRefresh - Whether the fake starts with an update pending.
 * @param updateServiceWorker - Spy standing in for the real updater.
 * @returns A hook suitable for the `useRegister` prop.
 */
function createUseRegister(
  initialNeedRefresh: boolean,
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>,
) {
  return function useRegister() {
    const [needRefresh, setNeedRefresh] = useState(initialNeedRefresh);
    const [offlineReady, setOfflineReady] = useState(true);
    return {
      needRefresh: [needRefresh, setNeedRefresh] as [
        boolean,
        typeof setNeedRefresh,
      ],
      offlineReady: [offlineReady, setOfflineReady] as [
        boolean,
        typeof setOfflineReady,
      ],
      updateServiceWorker,
    };
  };
}

describe('ReloadPrompt', () => {
  it('renders nothing when no refresh is needed', () => {
    const useRegister = createUseRegister(false, vi.fn(async () => undefined));
    const { container } = render(<ReloadPrompt useRegister={useRegister} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the update toast and reloads once when Reload is clicked', async () => {
    const updateServiceWorker = vi.fn(async () => undefined);
    const useRegister = createUseRegister(true, updateServiceWorker);
    render(<ReloadPrompt useRegister={useRegister} />);

    const toast = screen.getByRole('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
    expect(
      screen.getByText('A new version of OpenDraft is available.'),
    ).toBeInTheDocument();

    const reload = screen.getByRole('button', { name: 'Reload' });
    fireEvent.click(reload);

    expect(updateServiceWorker).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(reload).toBeDisabled());
  });

  it('hides the toast when Close is clicked', () => {
    const useRegister = createUseRegister(true, vi.fn(async () => undefined));
    render(<ReloadPrompt useRegister={useRegister} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(
      screen.queryByText('A new version of OpenDraft is available.'),
    ).toBeNull();
  });
});
