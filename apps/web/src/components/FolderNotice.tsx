/** Props for {@link FolderNotice}. */
export interface FolderNoticeProps {
  /** Navigate to the `manuscripts` folder. */
  onGoToManuscripts: () => void;
}

/**
 * Notice shown for a directory the shell cannot open: every folder outside
 * a manuscript root, plus the manuscripts overview until T10. Offers the
 * single action of opening the `manuscripts` folder.
 *
 * @param props - See {@link FolderNoticeProps}.
 * @returns The folder-notice surface with the manuscripts action.
 */
export function FolderNotice({ onGoToManuscripts }: FolderNoticeProps) {
  return (
    <div
      data-testid="folder-notice"
      className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <p className="text-base font-medium text-gray-700">Folders can&apos;t be opened here</p>
      <button
        type="button"
        onClick={onGoToManuscripts}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Go to manuscripts
      </button>
    </div>
  );
}
