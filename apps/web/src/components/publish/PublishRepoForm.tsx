import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Owner } from '../../github/bff-client';
import { installUrl } from '../../github/bff-client';
import { toManuscriptId } from '../../project/slugify';
import type { PreflightResult } from '../../publish/preflight';
import { PublishChecks } from './PublishChecks';

/** Visibility of the repository created on GitHub. */
export type PublishVisibility = 'public' | 'private';

/** Values submitted when the viewer publishes a local project. */
export interface PublishRepoInput {
  /** Account that receives the new repository. */
  owner: string;
  /** Repository name. */
  name: string;
  /** `public` for "Anyone", `private` for "Only people I invite". */
  visibility: PublishVisibility;
}

/** Props for {@link PublishRepoForm}. */
export interface PublishRepoFormProps {
  /** Display name of the local project; drives the prefilled repository name. */
  projectName: string;
  /** Owners the viewer can publish to, as returned by `GET /@api/owners`. */
  owners: Owner[];
  /** Same-origin path to reopen after an installation round trip. */
  returnTo: string;
  /** True while preflight is still running. */
  running: boolean;
  /** Latest preflight result, or null before the first run finishes. */
  result: PreflightResult | null;
  /** Called with a preflight finding's path when the user opens that file. */
  onOpenFile: (path: string) => void;
  /** Called with the chosen owner, name and visibility on submit. */
  onPublish?: (input: PublishRepoInput) => Promise<void> | void;
}

const LINK_CLASS = 'text-sm font-medium text-gray-900 underline underline-offset-2';
const RADIO_CLASS = 'h-4 w-4 border-gray-300 text-gray-900 focus-visible:outline focus-visible:outline-2';
const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** First owner whose installation covers all repositories, or an empty string. */
function firstEnabledOwner(owners: Owner[]): string {
  return owners.find((owner) => owner.allRepos)?.login ?? '';
}

/** One selectable owner row with avatar, login and access state. */
function OwnerOption({
  owner,
  selected,
  returnTo,
  onSelect,
}: {
  owner: Owner;
  selected: boolean;
  returnTo: string;
  onSelect: (login: string) => void;
}) {
  return (
    <li className="flex items-center gap-2 py-1">
      <input
        type="radio"
        id={`publish-owner-${owner.login}`}
        name="publish-owner"
        className={RADIO_CLASS}
        checked={selected}
        disabled={!owner.allRepos}
        onChange={() => onSelect(owner.login)}
      />
      <img
        src={owner.avatarUrl}
        alt={`${owner.login} avatar`}
        className="h-6 w-6 rounded-full"
      />
      <label htmlFor={`publish-owner-${owner.login}`} className="text-sm text-gray-800">
        {owner.login}
      </label>
      {owner.allRepos ? null : (
        <a href={installUrl(returnTo)} className={LINK_CLASS}>
          needs access · Manage
        </a>
      )}
    </li>
  );
}

/** Owner picker with avatars, disabled accounts and the add-organization link. */
function OwnerPicker({
  owners,
  selected,
  returnTo,
  onSelect,
}: {
  owners: Owner[];
  selected: string;
  returnTo: string;
  onSelect: (login: string) => void;
}) {
  return (
    <fieldset className="mb-3">
      <legend className="text-sm font-medium text-gray-700">Owner</legend>
      <ul className="mt-1">
        {owners.map((owner) => (
          <OwnerOption
            key={owner.login}
            owner={owner}
            selected={selected === owner.login}
            returnTo={returnTo}
            onSelect={onSelect}
          />
        ))}
      </ul>
      <a href={installUrl(returnTo)} className={`${LINK_CLASS} mt-2 inline-block`}>
        + Add another organization
      </a>
    </fieldset>
  );
}

/** Repository name field prefilled from the project name. */
function NameField({
  name,
  onName,
}: {
  name: string;
  onName: (value: string) => void;
}) {
  return (
    <label className="mb-3 block text-sm font-medium text-gray-700">
      Name
      <input
        type="text"
        aria-label="Name"
        value={name}
        className={FIELD_CLASS}
        onChange={(event) => onName(event.target.value)}
      />
    </label>
  );
}

/** Visibility radio group defaulting to a private repository. */
function VisibilityPicker({
  visibility,
  onVisibility,
}: {
  visibility: PublishVisibility;
  onVisibility: (next: PublishVisibility) => void;
}) {
  return (
    <fieldset className="mb-3">
      <legend className="text-sm font-medium text-gray-700">Who can see it</legend>
      <label className="mt-1 flex items-center gap-2 text-sm text-gray-800">
        <input
          type="radio"
          name="publish-visibility"
          className={RADIO_CLASS}
          checked={visibility === 'public'}
          onChange={() => onVisibility('public')}
        />
        Anyone
      </label>
      <label className="mt-1 flex items-center gap-2 text-sm text-gray-800">
        <input
          type="radio"
          name="publish-visibility"
          className={RADIO_CLASS}
          checked={visibility === 'private'}
          onChange={() => onVisibility('private')}
        />
        Only people I invite
      </label>
    </fieldset>
  );
}

/** Return true when the form can be submitted. */
function canSubmit(
  owner: string,
  name: string,
  running: boolean,
  result: PreflightResult | null,
): boolean {
  return !running && result !== null && result.ok && owner !== '' && name.trim() !== '';
}

/** Keep the selected owner valid as the owner list loads or changes. */
function useOwnerSelection(owners: Owner[]): [string, (login: string) => void] {
  const [owner, setOwner] = useState(() => firstEnabledOwner(owners));
  useEffect(() => {
    const stillValid = owners.some((entry) => entry.login === owner && entry.allRepos);
    if (!stillValid) setOwner(firstEnabledOwner(owners));
  }, [owners, owner]);
  return [owner, setOwner];
}

/** Track submission state and forward valid submits to `onPublish`. */
function usePublishSubmit(
  enabled: boolean,
  input: PublishRepoInput,
  onPublish: ((value: PublishRepoInput) => Promise<void> | void) | undefined,
) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!enabled) return;
    setSubmitting(true);
    setError(null);
    try {
      await onPublish?.(input);
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setSubmitting(false);
    }
  };
  return { submitting, error, submit };
}

/**
 * Publish-to-GitHub form for a local project: preflight checks on top, the
 * owner picker, the slug-prefilled repository name, visibility choice and the
 * primary Publish action.
 *
 * @param props - See {@link PublishRepoFormProps}.
 */
export function PublishRepoForm({
  projectName,
  owners,
  returnTo,
  running,
  result,
  onOpenFile,
  onPublish,
}: PublishRepoFormProps) {
  const [owner, setOwner] = useOwnerSelection(owners);
  const [name, setName] = useState(() => toManuscriptId(projectName));
  const [visibility, setVisibility] = useState<PublishVisibility>('private');
  const enabled = canSubmit(owner, name, running, result);
  const input: PublishRepoInput = { owner, name: name.trim(), visibility };
  const { submitting, error, submit } = usePublishSubmit(enabled, input, onPublish);

  return (
    <form onSubmit={submit} className="flex flex-col">
      <div className="mb-3">
        <PublishChecks running={running} result={result} onOpenFile={onOpenFile} />
      </div>
      <OwnerPicker
        owners={owners}
        selected={owner}
        returnTo={returnTo}
        onSelect={setOwner}
      />
      <NameField name={name} onName={setName} />
      <VisibilityPicker visibility={visibility} onVisibility={setVisibility} />
      {error !== null ? (
        <p role="alert" className="mb-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={!enabled || submitting}
        className="min-h-11 rounded-md bg-black px-4 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Publishing…' : 'Publish'}
      </button>
    </form>
  );
}
