import { useState } from 'react';
import { useRegisterSW } from './register-sw.js';

/** The registration hook shape, injectable so tests avoid the virtual module. */
type UseRegisterSW = typeof useRegisterSW;

/** Props for {@link ReloadPrompt}. */
export interface ReloadPromptProps {
  /** Hook used to read update state; defaults to the real PWA hook. */
  useRegister?: UseRegisterSW;
}

/**
 * Bottom-right toast announcing a new OpenDraft build, with actions to reload
 * into the updated service worker or dismiss the prompt.
 *
 * @param props - Optional hook injection for tests.
 * @returns The update toast, or null when no refresh is pending.
 */
export function ReloadPrompt({
  useRegister = useRegisterSW,
}: ReloadPromptProps) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [, setOfflineReady],
    updateServiceWorker,
  } = useRegister();
  const [reloading, setReloading] = useState(false);

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
    >
      <p>A new version of OpenDraft is available.</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={reloading}
          onClick={() => {
            setReloading(true);
            void updateServiceWorker();
          }}
          className="rounded-md bg-white px-3 py-1 font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => {
            setNeedRefresh(false);
            setOfflineReady(false);
          }}
          className="rounded-md px-3 py-1 font-medium text-gray-200 hover:bg-gray-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default ReloadPrompt;
