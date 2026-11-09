/**
 * Block editor shell: one collapsible container per included block in
 * `article.qmd` include order, hover-revealed '+' insert points between
 * blocks and at the end that open the add-section dialog at the clicked
 * position, and a single delete confirmation naming the section and
 * listing every `@sec-` reference that would break.
 */
import { useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { SaveStatus } from '../components/AppHeader';
import type { BlockDraft } from './AddBlockForm';
import { AddSectionDialog } from './AddSectionDialog';
import { BlockBody } from './BlockBody';
import { BlockContainer } from './BlockContainer';
import { EmptyState } from './EmptyState';
import { useBlocks } from './use-blocks';
import type { BlockEntry } from './use-blocks';
import { useCollapseState } from './use-collapse-state';
import { requestFocusForShort } from '../caret-mode-switch';

/** Props for {@link BlockEditor}. */
export interface BlockEditorProps {
  /** Workspace holding the manuscript files. */
  ws: WorkspaceAdapter;
  /** Manuscript directory, e.g. `manuscripts/demo`. */
  dir: string;
  /** Project key scoping the persisted collapse state. */
  projectKey: string;
}

/** Delete confirmation state: the section and the refs that would dangle. */
interface DeleteTarget {
  /** Short name of the block being deleted. */
  short: string;
  /** Section title shown in the dialog heading. */
  title: string;
  /** One entry per breaking reference, e.g. `'@sec-methods in intro'`. */
  refs: string[];
}

/**
 * Collect every `@sec-<short>` reference in other block files that would
 * break when the block is deleted. Mirrors the scope of
 * `rewriteOtherRefs`: every block file but the target, one entry per
 * occurrence, sorted for a stable dialog order.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory.
 * @param short - Short name of the block about to be deleted.
 * @returns One `'@sec-<short> in <source>'` string per occurrence.
 */
async function findBreakingRefs(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
): Promise<string[]> {
  const token = `@sec-${short}`;
  const refs: string[] = [];
  for (const file of await ws.listFiles(`${dir}/blocks`)) {
    if (file === `${short}.qmd`) continue;
    const text = await ws.readFile(`${dir}/blocks/${file}`);
    if (text === null) continue;
    const pattern = new RegExp(`${token}(?![a-z0-9-])`, 'g');
    const source = file.replace(/\.qmd$/, '');
    for (let i = 1; i <= (text.match(pattern)?.length ?? 0); i += 1) {
      refs.push(`${token} in ${source}`);
    }
  }
  return refs.sort();
}

/**
 * Hover-revealed '+' insert point between blocks and at the end.
 *
 * @param props - Handler opening the add-section dialog at this point.
 * @returns The insert button.
 */
function InsertPoint({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      type="button"
      aria-label="Insert block here"
      onClick={onAdd}
      className="flex h-6 w-full items-center justify-center text-lg text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
    >
      +
    </button>
  );
}

/** Props for {@link BlockRow}. */
interface BlockRowProps {
  /** The block rendered in this row. */
  block: BlockEntry;
  /** Whether the add-section dialog is open at this row's insert point. */
  formOpen: boolean;
  /** Whether the block body is collapsed. */
  collapsed: boolean;
  /** Workspace holding the manuscript files, forwarded to the body. */
  ws: WorkspaceAdapter;
  /** Manuscript directory, forwarded to the body. */
  dir: string;
  /** Flip the collapsed state. */
  onToggle: () => void;
  /** Open the delete confirmation for this block. */
  onOverflow: () => void;
  /** Open the add-section dialog at this row's insert point. */
  onAdd: () => void;
  /** Create the block from the dialog draft. */
  onCreate: (draft: BlockDraft) => void;
  /** Close the add-section dialog. */
  onClose: () => void;
}

/**
 * One list row: the insert point, an optional add-section dialog and the
 * collapsible block container.
 *
 * @param props - See {@link BlockRowProps}.
 * @returns The row markup.
 */
function BlockRow({
  block,
  formOpen,
  collapsed,
  ws,
  dir,
  onToggle,
  onOverflow,
  onAdd,
  onCreate,
  onClose,
}: BlockRowProps) {
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  return (
    <div className="group">
      <InsertPoint onAdd={onAdd} />
      {formOpen && <AddSectionDialog onCreate={(draft) => onCreate(draft as BlockDraft)} onClose={onClose} />}
      <BlockContainer
        short={block.short}
        title={block.title}
        mode="visual"
        collapsed={collapsed}
        onToggle={onToggle}
        onOverflow={onOverflow}
        wordCount={wordCount}
        saveStatus={saveStatus}
      >
        <BlockBody
          ws={ws}
          dir={dir}
          short={block.short}
          title={block.title}
          collapsed={collapsed}
          onWordCount={setWordCount}
          onSaveStatus={setSaveStatus}
        />
      </BlockContainer>
    </div>
  );
}

/** Props for {@link DeleteConfirm}. */
interface DeleteConfirmProps {
  /** Target naming the section and breaking refs; null renders nothing. */
  target: DeleteTarget | null;
  /** Delete the section; invoked by the confirm button. */
  onConfirm: () => Promise<void>;
  /** Close the dialog without deleting. */
  onCancel: () => void;
}

/**
 * Single delete confirmation: names the section and lists every
 * `@sec-` reference that would break. Confirm deletes, cancel closes.
 *
 * @param props - See {@link DeleteConfirmProps}.
 * @returns The dialog markup.
 */
function DeleteConfirm({ target, onConfirm, onCancel }: DeleteConfirmProps) {
  if (target === null) return null;
  const { title, refs } = target;
  return (
    <div
      role="dialog"
      aria-label={`Delete ${title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Delete {title}</h2>
        {refs.length === 0 ? (
          <p className="mb-3 text-sm text-gray-600">
            No @sec- references point at this section.
          </p>
        ) : (
          <>
            <p className="mb-1 text-sm text-gray-600">
              Deleting breaks these references:
            </p>
            <ul className="mb-3 list-inside list-disc text-sm text-gray-700">
              {refs.map((ref, index) => (
                <li key={`${ref}:${index}`}>{ref}</li>
              ))}
            </ul>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className="min-h-11 rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Delete block
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Block editor shell: renders the include-ordered block list as
 * collapsible containers with hover '+' insert points between them and
 * at the end, wires the add-section dialog to `createBlock` at the clicked
 * position, and opens one delete confirmation per block that names the
 * section and lists every breaking `@sec-` reference before deleting.
 *
 * @param props - See {@link BlockEditorProps}.
 * @returns The shell markup, or nothing while the list loads.
 */
export function BlockEditor({ ws, dir, projectKey }: BlockEditorProps) {
  const { loading, blocks, createBlock, deleteBlock } = useBlocks(ws, dir);
  const shorts = blocks.map((block) => block.short);
  const { isCollapsed, toggle } = useCollapseState(projectKey, shorts);
  const [addingAt, setAddingAt] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const closeForm = (): void => setAddingAt(null);
  const createAt = (position: number) => (draft: BlockDraft): void => {
    closeForm();
    void createBlock(position, draft.title).then(() => { window.dispatchEvent(new CustomEvent('opendraft:files-changed')); requestFocusForShort(draft.short); });
  };
  const openDelete = (block: BlockEntry): void => {
    void findBreakingRefs(ws, dir, block.short).then((refs) => setDeleting({ short: block.short, title: block.title, refs }));
  };
  const confirmDelete = async (): Promise<void> => {
    if (deleting === null) return;
    await deleteBlock(deleting.short); setDeleting(null);
  };
  const closeDelete = (): void => setDeleting(null);
  if (loading) return null;
  // Loaded with zero blocks: the preset picker replaces the whole list.
  if (blocks.length === 0) return <EmptyState onCreate={createAt(0)} />;
  return (
    <div className="space-y-2">
      {blocks.map((block, index) => (
        <BlockRow
          key={block.short}
          block={block} formOpen={addingAt === index}
          collapsed={isCollapsed(block.short)}
          ws={ws} dir={dir}
          onToggle={() => toggle(block.short)}
          onOverflow={() => openDelete(block)}
          onAdd={() => setAddingAt(index)}
          onCreate={createAt(index)}
          onClose={closeForm}
        />
      ))}
      <div>
        <button
          type="button" onClick={() => setAddingAt(blocks.length)}
          className="flex h-9 w-full items-center justify-center rounded-md border border-dashed border-gray-300 text-sm text-gray-500 hover:bg-gray-50"
        >
          + Add section
        </button>
        {addingAt === blocks.length && <AddSectionDialog onCreate={(draft) => createAt(blocks.length)(draft as BlockDraft)} onClose={closeForm} />}
      </div>
      <DeleteConfirm target={deleting} onConfirm={confirmDelete} onCancel={closeDelete} />
    </div>
  );
}
