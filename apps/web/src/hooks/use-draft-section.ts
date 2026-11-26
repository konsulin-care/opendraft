/** Header draft section: split action and workflow dialogs. */
import { Fragment, createElement, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ProjectRecord, WorkspaceAdapter } from '@opendraft/workspace';
import type { BffSession, Owner } from '../github/bff-client';
import { ConflictDialog } from '../components/draft/ConflictDialog';
import { DraftAction } from '../components/draft/DraftAction';
import type { DraftActionItem } from '../components/draft/DraftAction';
import { PublishDialog } from '../components/publish/PublishDialog';
import type { PublishDialogDraft, PublishDialogInput } from '../components/publish/PublishDialog';
import { PublishRepoForm } from '../components/publish/PublishRepoForm';
import type { PublishRepoInput } from '../components/publish/PublishRepoForm';
import { EditPopover } from '../reader/EditPopover';
import type { PreflightResult } from '../publish/preflight';
import type { DraftNameStatus } from '../suggest/branches';
import { useDraft } from './use-draft';
import type { UseDraftDeps, UseDraftResult } from './use-draft';
import { headerStatus } from './draft-header-status';
import type { HeaderStatus } from './draft-header-status';

type DialogMode = 'send' | 'update' | 'publish';
type Gate = 'sign-in' | 'install';
const h = createElement;
/** Dependencies of `useDraftSection`: draft deps plus optional UI hooks. */
export interface DraftSectionDeps extends UseDraftDeps {
  /** Open a workspace file from a preflight finding. */
  openFile?: (path: string) => void;
  /** Injected preflight runner for tests and alternate shells. */
  runPreflight?: (workspace: WorkspaceAdapter | null) => Promise<PreflightResult>;
  /** Injected draft-name check for the send dialog. */
  checkName?: (name: string) => Promise<DraftNameStatus>;
}
/** Input of `useDraftSection`. */
export interface UseDraftSectionInput {
  /** Active project, or null before boot completes. */
  project: ProjectRecord | null;
  /** IndexedDB workspace of the active project. */
  workspace: WorkspaceAdapter | null;
  /** Signed-in viewer, or null when signed out. */
  session: BffSession | null;
  /** Accounts the viewer can publish to; empty means install is needed. */
  owners: readonly Owner[];
  /** Draft workflow dependencies, plus optional UI hooks. */
  deps: DraftSectionDeps;
}
/** Nodes handed to the shared header and dialog layer. */
export interface DraftSection {
  /** Split action button for the draft workflow. */
  action: ReactNode;
  /** Header status for the title trigger and details panel, or null before boot. */
  status: HeaderStatus | null;
  /** Modal dialogs and gate popovers, or null when nothing is open. */
  dialogs: ReactNode;
}
interface SectionContext {
  project: ProjectRecord;
  workspace: WorkspaceAdapter | null;
  session: BffSession | null;
  owners: readonly Owner[];
  draft: UseDraftResult;
  deps: DraftSectionDeps;
  openDialog: (mode: DialogMode) => void;
  openGate: (gate: Gate) => void;
}
interface DialogNodesProps {
  context: SectionContext;
  mode: DialogMode | null;
  gate: Gate | null;
  running: boolean;
  result: PreflightResult | null;
  closeDialog: () => void;
  closeGate: () => void;
}
const MODAL = 'fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center';
const PANEL = 'max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl';
const CANCEL = 'mt-2 min-h-11 rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100';
/** Open the sign-in or install gate when the action needs one. */
function hasAccess(context: SectionContext): boolean {
  if (context.session === null) {
    context.openGate('sign-in');
    return false;
  }
  if (context.owners.length === 0) {
    context.openGate('install');
    return false;
  }
  return true;
}
function runAction(context: SectionContext, label: string): void {
  if (label === 'View on GitHub') {
    const url = context.draft.status?.url;
    if (url !== undefined) window.open(url, '_blank', 'noopener');
    return;
  }
  if (!hasAccess(context)) return;
  if (label === 'Save to GitHub') void context.draft.save();
  else if (label === 'Start a new draft') void context.draft.startNew();
  else if (label === 'Publish to GitHub') context.openDialog('publish');
  else if (label === 'Send update') context.openDialog('update');
  else if (label === 'Submit' || label === 'Rename draft') {
    context.openDialog('send');
  }
}
function actionNode(context: SectionContext | null): ReactNode {
  if (context === null) return null;
  const { view, busy } = context.draft;
  const onMenu = (item: DraftActionItem): void =>
    runAction(context, typeof item === 'string' ? item : item.label);
  return h(DraftAction, {
    label: view.primary,
    items: view.menu,
    busy,
    kind: view.kind,
    onPrimary: () => runAction(context, view.primary),
    onMenu,
  });
}
function dialogDraft(project: ProjectRecord, session: BffSession | null): PublishDialogDraft {
  const source = project.source;
  if (source.kind !== 'github') {
    return { owner: '', repo: '', login: session?.login ?? '', branch: '', pushed: false };
  }
  return {
    owner: source.owner,
    repo: source.repo,
    login: session?.login ?? source.owner,
    branch: source.branch,
    pushed: source.pushed,
  };
}
async function submitDialog(
  mode: 'send' | 'update',
  draft: UseDraftResult,
  input: PublishDialogInput,
): Promise<void> {
  if (mode === 'send') await draft.send({ name: input.draftName, note: input.note, title: input.change });
  else await draft.update({ message: input.note });
}
function sendDialog(context: SectionContext, mode: 'send' | 'update', close: () => void) {
  const { deps, workspace } = context;
  const runner = deps.runPreflight;
  return h(PublishDialog, {
    variant: mode,
    draft: dialogDraft(context.project, context.session),
    runPreflight: runner ? () => runner(workspace) : undefined,
    checkName: deps.checkName,
    onOpenFile: deps.openFile,
    onSubmit: (input: PublishDialogInput) => submitDialog(mode, context.draft, input),
    onClose: close,
  });
}
function publishForm(context: SectionContext, props: Pick<DialogNodesProps, 'running' | 'result' | 'closeDialog'>) {
  const { running, result, closeDialog } = props;
  const publish = async (input: PublishRepoInput): Promise<void> => {
    await context.draft.publish({
      owner: input.owner,
      repo: input.name,
      private: input.visibility === 'private',
    });
    closeDialog();
  };
  return h(PublishRepoForm, {
    projectName: context.project.name,
    owners: [...context.owners],
    returnTo: window.location.pathname,
    running,
    result,
    onOpenFile: context.deps.openFile ?? (() => undefined),
    onPublish: publish,
  });
}
function publishDialog(context: SectionContext, props: Pick<DialogNodesProps, 'running' | 'result' | 'closeDialog'>) {
  const close = props.closeDialog;
  const panel = h(
    'div',
    { className: PANEL },
    h('h2', { className: 'mb-3 text-base font-semibold text-gray-900' }, 'Publish to GitHub'),
    publishForm(context, props),
    h('button', { type: 'button', onClick: close, className: CANCEL }, 'Cancel'),
  );
  return h('div', { role: 'dialog', 'aria-label': 'Publish to GitHub', className: MODAL }, panel);
}
function gatePopover(gate: Gate, context: SectionContext, close: () => void) {
  const source = context.project.source;
  const route = source.kind === 'github'
    ? { owner: source.upstream.owner, repo: source.upstream.repo }
    : { owner: '', repo: '' };
  return h(EditPopover, { variant: gate, route, onClose: close });
}
function dialogNodes(props: DialogNodesProps): ReactNode {
  const { context, mode, gate, running, result, closeDialog, closeGate } = props;
  const source = context.project.source;
  const children: ReactNode[] = [];
  if (mode === 'publish') children.push(publishDialog(context, { running, result, closeDialog }));
  else if (mode !== null && source.kind === 'github') children.push(sendDialog(context, mode, closeDialog));
  if (context.draft.conflicts !== null) {
    children.push(h(ConflictDialog, {
      key: 'conflicts',
      paths: context.draft.conflicts,
      onResolve: context.draft.resolveConflicts,
    }));
  }
  if (gate !== null) children.push(gatePopover(gate, context, closeGate));
  return children.length === 0 ? null : h(Fragment, null, ...children);
}
function useLocalPreflight(
  enabled: boolean,
  workspace: WorkspaceAdapter | null,
  runner: DraftSectionDeps['runPreflight'],
): { running: boolean; result: PreflightResult | null } {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const run = useCallback(async (): Promise<PreflightResult> => {
    if (runner) return runner(workspace);
    if (!workspace) return { ok: true, errors: [], warnings: [] };
    const { preflight } = await import('../publish/preflight');
    return preflight(workspace);
  }, [runner, workspace]);
  useEffect(() => {
    if (!enabled) {
      setRunning(false);
      setResult(null);
      return undefined;
    }
    let active = true;
    setRunning(true);
    setResult(null);
    run()
      .then((next) => active && setResult(next))
      .catch((thrown: unknown) => {
        if (!active) return;
        const message = thrown instanceof Error ? thrown.message : String(thrown);
        setResult({
          ok: false,
          errors: [{ level: 'error', location: 'preflight', path: 'preflight', message }],
          warnings: [],
        });
      })
      .finally(() => active && setRunning(false));
    return () => {
      active = false;
    };
  }, [enabled, run]);
  return { running, result };
}
/**
 * Build the header action, status and workflow dialogs for a project.
 *
 * @param input - Active project, workspace, session, owners and draft deps.
 * @returns The action node, header status and dialogs node.
 */
export function useDraftSection({ project, workspace, session, owners, deps }: UseDraftSectionInput): DraftSection {
  const draft = useDraft(project, deps);
  const [mode, setMode] = useState<DialogMode | null>(null);
  const [gate, setGate] = useState<Gate | null>(null);
  const local = useLocalPreflight(mode === 'publish', workspace, deps.runPreflight);
  const context: SectionContext | null = project === null
    ? null
    : { project, workspace, session, owners, draft, deps, openDialog: setMode, openGate: setGate };
  const closeDialog = useCallback(() => setMode(null), []);
  const closeGate = useCallback(() => setGate(null), []);
  return {
    action: actionNode(context),
    status: context === null ? null : headerStatus({
      source: context.project.source,
      draftLabel: context.draft.view.chip,
      status: context.draft.status,
      error: context.draft.error,
      notice: context.draft.notice,
    }),
    dialogs: context === null ? null : dialogNodes({
      context, mode, gate, running: local.running, result: local.result, closeDialog, closeGate,
    }),
  };
}
export default useDraftSection;
